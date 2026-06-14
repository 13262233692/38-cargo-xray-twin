precision highp sampler3D;
precision highp float;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;

uniform sampler3D uDensityTexture;
uniform sampler3D uZEffectiveTexture;
uniform sampler2D uTransferFunctionDensity;
uniform sampler2D uTransferFunctionZeff;

uniform vec3 uVolumeSize;
uniform float uSampleRate;
uniform float uBrightness;
uniform float uContrast;
uniform vec3 uSlicePlane;
uniform vec3 uSliceEnabled;
uniform float uHighlightHeavyMetals;
uniform float uHighlightContraband;

uniform vec3 uCameraPos;
uniform mat4 uInverseModelMatrix;

uniform float uCameraDistance;
uniform float uAdaptiveStepEnabled;
uniform float uMaxStepFactor;
uniform float uMinStepFactor;

const int MAX_STEPS_HARD_LIMIT = 384;
const float EARLY_TERMINATION_THRESHOLD = 0.95;
const float EMPTY_SPACE_THRESHOLD = 0.015;
const float REFERENCE_CAMERA_DISTANCE = 3.0;
const float MIN_VOXEL_STEP = 0.3;

vec2 intersectBox(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax) {
  vec3 invRd = 1.0 / rd;
  vec3 tMin = (boxMin - ro) * invRd;
  vec3 tMax = (boxMax - ro) * invRd;
  vec3 t1 = min(tMin, tMax);
  vec3 t2 = max(tMin, tMax);
  float tNear = max(max(t1.x, t1.y), t1.z);
  float tFar = min(min(t2.x, t2.y), t2.z);
  return vec2(tNear, tFar);
}

vec4 sampleTransferFunctionDensity(float value) {
  return texture2D(uTransferFunctionDensity, vec2(value, 0.5));
}

vec4 sampleTransferFunctionZeff(float value) {
  return texture2D(uTransferFunctionZeff, vec2(value, 0.5));
}

vec3 getGradient(vec3 pos, float delta) {
  float dx = texture(uDensityTexture, pos + vec3(delta, 0.0, 0.0)).r 
           - texture(uDensityTexture, pos - vec3(delta, 0.0, 0.0)).r;
  float dy = texture(uDensityTexture, pos + vec3(0.0, delta, 0.0)).r 
           - texture(uDensityTexture, pos - vec3(0.0, delta, 0.0)).r;
  float dz = texture(uDensityTexture, pos + vec3(0.0, 0.0, delta)).r 
           - texture(uDensityTexture, pos - vec3(0.0, 0.0, delta)).r;
  return normalize(vec3(dx, dy, dz) + vec3(1e-6));
}

float fresnel(vec3 normal, vec3 viewDir, float power) {
  return pow(1.0 - max(dot(normal, viewDir), 0.0), power);
}

float computeDistanceNormalization(float cameraDist) {
  float normalizedDist = clamp(cameraDist / REFERENCE_CAMERA_DISTANCE, 0.3, 3.0);
  return sqrt(normalizedDist);
}

float computeAdaptiveStepSize(float density, float baseStep, float maxFactor, float minFactor) {
  float t = smoothstep(0.0, 0.3, density);
  float factor = mix(maxFactor, minFactor, t);
  return baseStep * factor;
}

float jumpEmptySpace(vec3 uvw, vec3 uvwDir, float baseStep, float maxJump) {
  float currentT = 0.0;
  float jumpStep = baseStep * 4.0;
  int maxJumps = int(maxJump / jumpStep);
  
  for (int i = 0; i < 16; i++) {
    if (i >= maxJumps) break;
    
    vec3 testUvw = uvw + uvwDir * (currentT + jumpStep);
    if (testUvw.x < 0.0 || testUvw.x > 1.0 || testUvw.y < 0.0 || testUvw.y > 1.0 || testUvw.z < 0.0 || testUvw.z > 1.0) {
      break;
    }
    
    float testDensity = texture(uDensityTexture, testUvw).r;
    if (testDensity > EMPTY_SPACE_THRESHOLD) {
      break;
    }
    
    currentT += jumpStep;
  }
  
  return currentT;
}

void main() {
  vec3 rayOrigin = (uInverseModelMatrix * vec4(uCameraPos, 1.0)).xyz;
  vec3 rayDir = normalize(vLocalPosition - rayOrigin);

  vec3 boxMin = vec3(-0.5);
  vec3 boxMax = vec3(0.5);
  
  vec2 tHit = intersectBox(rayOrigin, rayDir, boxMin, boxMax);
  
  if (tHit.x > tHit.y) {
    discard;
  }
  
  float tStart = max(tHit.x, 0.0);
  float tEnd = tHit.y;
  
  vec3 startPos = rayOrigin + rayDir * tStart;
  vec3 endPos = rayOrigin + rayDir * tEnd;
  
  float maxDist = distance(startPos, endPos);
  
  float distNorm = computeDistanceNormalization(uCameraDistance);
  float voxelSize = 1.0 / max(uVolumeSize.x, max(uVolumeSize.y, uVolumeSize.z));
  float minStep = voxelSize * MIN_VOXEL_STEP;
  float baseStep = max((maxDist / uSampleRate) * distNorm, minStep);
  
  vec3 uvwStart = startPos + 0.5;
  vec3 uvwDir = rayDir;
  
  vec4 accumColor = vec4(0.0);
  float accumOpacity = 0.0;
  
  float currentT = 0.0;
  int stepCount = 0;
  float currentStep = baseStep;
  
  float lightEnergy = 1.0;
  
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
  vec3 viewDir = -rayDir;
  float gradientDelta = 1.0 / uVolumeSize.x;
  
  for (int i = 0; i < MAX_STEPS_HARD_LIMIT; i++) {
    stepCount = i;
    
    if (currentT >= maxDist) break;
    if (accumOpacity >= EARLY_TERMINATION_THRESHOLD) break;
    
    vec3 uvw = uvwStart + uvwDir * currentT;
    
    if (uvw.x < 0.0 || uvw.x > 1.0 || uvw.y < 0.0 || uvw.y > 1.0 || uvw.z < 0.0 || uvw.z > 1.0) {
      break;
    }
    
    if (uSliceEnabled.x > 0.5 && uvw.x > uSlicePlane.x) {
      currentT += currentStep;
      continue;
    }
    if (uSliceEnabled.y > 0.5 && uvw.y > uSlicePlane.y) {
      currentT += currentStep;
      continue;
    }
    if (uSliceEnabled.z > 0.5 && uvw.z > uSlicePlane.z) {
      currentT += currentStep;
      continue;
    }
    
    float density = texture(uDensityTexture, uvw).r;
    float zeff = texture(uZEffectiveTexture, uvw).r;
    
    if (density < EMPTY_SPACE_THRESHOLD) {
      if (uAdaptiveStepEnabled > 0.5) {
        float maxJumpDist = maxDist - currentT;
        float jump = jumpEmptySpace(uvw, uvwDir, baseStep, maxJumpDist);
        if (jump > currentStep) {
          currentT += jump;
          continue;
        }
      }
      currentT += currentStep;
      continue;
    }
    
    if (uAdaptiveStepEnabled > 0.5) {
      currentStep = computeAdaptiveStepSize(density, baseStep, uMaxStepFactor, uMinStepFactor);
    }
    
    vec4 densityColor = sampleTransferFunctionDensity(density);
    vec4 zeffColor = sampleTransferFunctionZeff(zeff);
    
    vec3 sampleColor = mix(densityColor.rgb, zeffColor.rgb, 0.5);
    float sampleOpacity = densityColor.a * (0.5 + zeff * 0.5);
    
    if (uHighlightHeavyMetals > 0.5 && zeff > 0.75 && density > 0.5) {
      float heavyMetalFactor = smoothstep(0.75, 1.0, zeff) * smoothstep(0.5, 0.9, density);
      vec3 heavyMetalColor = vec3(1.0, 0.4, 0.0);
      sampleColor = mix(sampleColor, heavyMetalColor, heavyMetalFactor * 0.8);
      sampleOpacity = max(sampleOpacity, heavyMetalFactor * 0.9);
    }
    
    if (uHighlightContraband > 0.5 && density > 0.65 && density < 0.85 && zeff > 0.4 && zeff < 0.7) {
      float contrabandFactor = smoothstep(0.65, 0.75, density) * (1.0 - smoothstep(0.75, 0.85, density))
                             * smoothstep(0.4, 0.55, zeff) * (1.0 - smoothstep(0.55, 0.7, zeff));
      vec3 contrabandColor = vec3(1.0, 0.85, 0.0);
      sampleColor = mix(sampleColor, contrabandColor, contrabandFactor * 0.9);
      sampleOpacity = max(sampleOpacity, contrabandFactor * 0.8);
    }
    
    if (sampleOpacity > 0.05) {
      vec3 grad = getGradient(uvw, gradientDelta);
      float diffuse = max(dot(grad, lightDir), 0.0) * 0.5 + 0.5;
      float fresnelFactor = fresnel(grad, viewDir, 3.0);
      
      vec3 specularColor = vec3(1.0, 0.95, 0.8);
      vec3 halfDir = normalize(lightDir + viewDir);
      float specular = pow(max(dot(grad, halfDir), 0.0), 64.0);
      
      sampleColor *= diffuse * uBrightness;
      sampleColor += specularColor * specular * 0.5;
      sampleColor = mix(sampleColor, vec3(1.0), fresnelFactor * 0.3);
    } else {
      sampleColor *= uBrightness;
    }
    
    float contrastedColor = (sampleOpacity - 0.5) * uContrast + 0.5;
    sampleOpacity = clamp(contrastedColor, 0.0, 1.0);
    
    float stepLengthRatio = currentStep / baseStep;
    float adjustedOpacity = 1.0 - pow(1.0 - sampleOpacity, stepLengthRatio);
    
    float alpha = adjustedOpacity * (1.0 - accumOpacity);
    accumColor.rgb += sampleColor * alpha * lightEnergy;
    accumOpacity += alpha;
    
    lightEnergy *= (1.0 - adjustedOpacity * 0.5);
    
    currentT += currentStep;
  }
  
  accumColor.a = accumOpacity;
  
  if (accumColor.a < 0.01) {
    discard;
  }
  
  gl_FragColor = accumColor;
}
