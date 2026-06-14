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

vec2 intersectBox(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax) {
  vec3 tMin = (boxMin - ro) / rd;
  vec3 tMax = (boxMax - ro) / rd;
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

vec3 getGradient(vec3 pos) {
  float delta = 1.0 / uVolumeSize.x;
  float dx = texture(uDensityTexture, pos + vec3(delta, 0.0, 0.0)).r 
           - texture(uDensityTexture, pos - vec3(delta, 0.0, 0.0)).r;
  float dy = texture(uDensityTexture, pos + vec3(0.0, delta, 0.0)).r 
           - texture(uDensityTexture, pos - vec3(0.0, delta, 0.0)).r;
  float dz = texture(uDensityTexture, pos + vec3(0.0, 0.0, delta)).r 
           - texture(uDensityTexture, pos - vec3(0.0, 0.0, delta)).r;
  return normalize(vec3(dx, dy, dz));
}

float fresnel(vec3 normal, vec3 viewDir, float power) {
  return pow(1.0 - max(dot(normal, viewDir), 0.0), power);
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
  float stepSize = maxDist / uSampleRate;
  
  vec3 uvwStart = startPos + 0.5;
  vec3 uvwDir = rayDir * stepSize;
  
  vec4 accumColor = vec4(0.0);
  float accumOpacity = 0.0;
  
  for (int i = 0; i < 1024; i++) {
    if (float(i) >= uSampleRate) break;
    if (accumOpacity >= 0.99) break;
    
    float t = float(i) * stepSize;
    vec3 uvw = uvwStart + uvwDir * float(i);
    
    if (uvw.x < 0.0 || uvw.x > 1.0 || uvw.y < 0.0 || uvw.y > 1.0 || uvw.z < 0.0 || uvw.z > 1.0) {
      break;
    }
    
    if (uSliceEnabled.x > 0.5 && uvw.x > uSlicePlane.x) continue;
    if (uSliceEnabled.y > 0.5 && uvw.y > uSlicePlane.y) continue;
    if (uSliceEnabled.z > 0.5 && uvw.z > uSlicePlane.z) continue;
    
    float density = texture(uDensityTexture, uvw).r;
    float zeff = texture(uZEffectiveTexture, uvw).r;
    
    if (density < 0.01) continue;
    
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
    
    vec3 grad = getGradient(uvw);
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
    float diffuse = max(dot(grad, lightDir), 0.0) * 0.5 + 0.5;
    
    vec3 viewDir = -rayDir;
    float fresnelFactor = fresnel(grad, viewDir, 3.0);
    
    vec3 specularColor = vec3(1.0, 0.95, 0.8);
    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(grad, halfDir), 0.0), 64.0);
    
    sampleColor *= diffuse * uBrightness;
    sampleColor += specularColor * specular * 0.5;
    
    float contrastedColor = (sampleOpacity - 0.5) * uContrast + 0.5;
    sampleOpacity = clamp(contrastedColor, 0.0, 1.0);
    
    float alpha = sampleOpacity * (1.0 - accumOpacity);
    accumColor.rgb += sampleColor * alpha;
    accumOpacity += alpha;
  }
  
  accumColor.a = accumOpacity;
  
  if (accumColor.a < 0.01) {
    discard;
  }
  
  gl_FragColor = accumColor;
}
