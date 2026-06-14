#ifndef SIMULATED_DATA_GENERATOR_H
#define SIMULATED_DATA_GENERATOR_H

#include "volume_data.h"
#include <cmath>
#include <random>
#include <algorithm>

namespace cargo_xray {

class SimulatedDataGenerator {
public:
    SimulatedDataGenerator(uint32_t seed = 42) : rng_(seed) {}

    VolumeData generate_container_scan(uint32_t width, uint32_t height, uint32_t depth) {
        VolumeData result;
        result.dimensions = {width, height, depth};
        result.spacing_x = 1.0f;
        result.spacing_y = 1.0f;
        result.spacing_z = 1.0f;

        const size_t total = result.total_size();
        result.density_data.resize(total, 0);
        result.z_effective_data.resize(total, 0);

        const float cx = width * 0.5f;
        const float cy = height * 0.5f;
        const float cz = depth * 0.5f;

        const float container_wall_thickness = width * 0.03f;

        for (uint32_t z = 0; z < depth; ++z) {
            for (uint32_t y = 0; y < height; ++y) {
                for (uint32_t x = 0; x < width; ++x) {
                    const size_t idx = z * width * height + y * width + x;

                    const float nx = (x - cx) / (width * 0.5f);
                    const float ny = (y - cy) / (height * 0.5f);
                    const float nz = (z - cz) / (depth * 0.5f);

                    float density = 0.0f;
                    float zeff = 0.0f;

                    const float dist_to_wall_x = std::abs(std::abs(nx) - 0.85f);
                    const float dist_to_wall_y = std::abs(std::abs(ny) - 0.80f);
                    const float dist_to_wall_z = std::abs(std::abs(nz) - 0.90f);
                    
                    const float min_wall_dist = std::min({dist_to_wall_x, dist_to_wall_y, dist_to_wall_z});
                    if (min_wall_dist < 0.05f) {
                        const float wall_factor = 1.0f - (min_wall_dist / 0.05f);
                        density = std::max(density, 0.55f * wall_factor + 0.35f);
                        zeff = std::max(zeff, 0.62f * wall_factor + 0.35f);
                    }

                    const float cargo_r = std::sqrt(nx*nx*0.7f + ny*ny + nz*nz*0.6f);
                    if (cargo_r < 0.65f) {
                        const float cargo_factor = 1.0f - cargo_r / 0.65f;
                        const float noise_val = noise(nx * 12.0f, ny * 8.0f, nz * 10.0f);
                        density = std::max(density, 0.15f + cargo_factor * 0.2f + noise_val * 0.1f);
                        zeff = std::max(zeff, 0.25f + cargo_factor * 0.15f + noise_val * 0.08f);
                    }

                    const float sphere1_r = std::sqrt(
                        std::pow(nx - 0.22f, 2) +
                        std::pow(ny + 0.12f, 2) +
                        std::pow(nz - 0.18f, 2)
                    );
                    if (sphere1_r < 0.13f) {
                        const float factor = 1.0f - sphere1_r / 0.13f;
                        density = std::max(density, 0.9f + factor * 0.1f);
                        zeff = std::max(zeff, 0.92f + factor * 0.05f);
                    }

                    const float sphere2_r = std::sqrt(
                        std::pow(nx + 0.28f, 2) +
                        std::pow(ny - 0.18f, 2) +
                        std::pow(nz + 0.12f, 2)
                    );
                    if (sphere2_r < 0.16f) {
                        const float factor = 1.0f - sphere2_r / 0.16f;
                        density = std::max(density, 0.70f + factor * 0.08f);
                        zeff = std::max(zeff, 0.52f + factor * 0.1f);
                    }

                    const float box_x = std::abs(nx - 0.08f);
                    const float box_y = std::abs(ny + 0.28f);
                    const float box_z = std::abs(nz + 0.22f);
                    const float box_dist = std::max({box_x, box_y, box_z});
                    if (box_dist < 0.20f) {
                        const float edge_dist = std::min({
                            std::abs(box_dist - 0.18f),
                            std::abs(box_x - 0.18f),
                            std::abs(box_y - 0.18f),
                            std::abs(box_z - 0.18f)
                        });
                        if (box_dist > 0.16f || edge_dist < 0.02f) {
                            const float factor = box_dist > 0.16f ? 1.0f : (1.0f - edge_dist / 0.02f);
                            density = std::max(density, 0.75f + factor * 0.15f);
                            zeff = std::max(zeff, 0.72f + factor * 0.12f);
                        }
                    }

                    const float cyl_r = std::sqrt(std::pow(nx + 0.15f, 2) + std::pow(nz - 0.05f, 2));
                    const float cyl_h = std::abs(ny - 0.05f);
                    if (cyl_r < 0.08f && cyl_h < 0.35f) {
                        const float r_factor = 1.0f - cyl_r / 0.08f;
                        const float h_factor = 1.0f - std::abs(cyl_h - 0.3f) / 0.35f;
                        const float factor = r_factor * 0.5f + 0.5f;
                        density = std::max(density, 0.45f * factor + 0.25f);
                        zeff = std::max(zeff, 0.38f * factor + 0.3f);
                    }

                    result.density_data[idx] = static_cast<uint8_t>(std::clamp(density, 0.0f, 1.0f) * 255.0f);
                    result.z_effective_data[idx] = static_cast<uint8_t>(std::clamp(zeff, 0.0f, 1.0f) * 255.0f);
                }
            }
        }

        return result;
    }

    ScanMetadata get_metadata() const {
        return {
            "CRG-DEMO-001",
            "2026-06-14T21:30:00",
            60.0f,
            150.0f,
            8.5f,
            92.0f
        };
    }

private:
    std::mt19937 rng_;

    float noise(float x, float y, float z) {
        const int xi = static_cast<int>(std::floor(x));
        const int yi = static_cast<int>(std::floor(y));
        const int zi = static_cast<int>(std::floor(z));
        
        const float xf = x - xi;
        const float yf = y - yi;
        const float zf = z - zi;

        const float u = smoothstep(xf);
        const float v = smoothstep(yf);
        const float w = smoothstep(zf);

        const float c000 = hash(xi, yi, zi);
        const float c100 = hash(xi + 1, yi, zi);
        const float c010 = hash(xi, yi + 1, zi);
        const float c110 = hash(xi + 1, yi + 1, zi);
        const float c001 = hash(xi, yi, zi + 1);
        const float c101 = hash(xi + 1, yi, zi + 1);
        const float c011 = hash(xi, yi + 1, zi + 1);
        const float c111 = hash(xi + 1, yi + 1, zi + 1);

        const float x00 = lerp(c000, c100, u);
        const float x10 = lerp(c010, c110, u);
        const float x01 = lerp(c001, c101, u);
        const float x11 = lerp(c011, c111, u);

        const float y0 = lerp(x00, x10, v);
        const float y1 = lerp(x01, x11, v);

        return lerp(y0, y1, w) * 0.5f + 0.5f;
    }

    float hash(int x, int y, int z) {
        int h = x * 374761393 + y * 668265263 + z * 2147483647;
        h = (h ^ (h >> 13)) * 1274126177;
        return static_cast<float>((h ^ (h >> 16)) & 0xffff) / 65535.0f * 2.0f - 1.0f;
    }

    static float lerp(float a, float b, float t) {
        return a + (b - a) * t;
    }

    static float smoothstep(float t) {
        return t * t * (3.0f - 2.0f * t);
    }
};

} // namespace cargo_xray

#endif // SIMULATED_DATA_GENERATOR_H
