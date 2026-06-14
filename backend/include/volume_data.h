#ifndef VOLUME_DATA_H
#define VOLUME_DATA_H

#include <cstdint>
#include <cstddef>
#include <vector>
#include <string>

namespace cargo_xray {

struct VolumeDimensions {
    uint32_t width;
    uint32_t height;
    uint32_t depth;
};

struct VolumeData {
    VolumeDimensions dimensions;
    std::vector<uint8_t> density_data;
    std::vector<uint8_t> z_effective_data;
    float spacing_x;
    float spacing_y;
    float spacing_z;

    size_t total_size() const {
        return static_cast<size_t>(dimensions.width) * 
               static_cast<size_t>(dimensions.height) * 
               static_cast<size_t>(dimensions.depth);
    }

    size_t slice_size() const {
        return static_cast<size_t>(dimensions.width) * 
               static_cast<size_t>(dimensions.height);
    }
};

struct SliceData {
    uint32_t slice_index;
    const uint8_t* density_slice;
    const uint8_t* z_effective_slice;
    size_t slice_size;
};

enum class DataSourceType {
    SIMULATED,
    HDF5_FILE,
    DICOM_SERIES,
    LIVE_SCANNER
};

struct ScanMetadata {
    std::string container_id;
    std::string scan_time;
    float energy_low_kev;
    float energy_high_kev;
    float max_density_gcm3;
    float max_z_effective;
};

} // namespace cargo_xray

#endif // VOLUME_DATA_H
