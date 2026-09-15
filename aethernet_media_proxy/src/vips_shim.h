// SPDX-License-Identifier: AGPL-3.0-or-later

#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct _VipsImage VipsImage;
struct aethernet_webp_anim_limits;

enum aethernet_deadline_status {
    AETHERNET_DEADLINE_PENDING = 0,
    AETHERNET_DEADLINE_REACHED = 1,
    AETHERNET_DEADLINE_CLOCK_FAILED = -1
};

enum aethernet_native_status {
    AETHERNET_NATIVE_STATUS_OK = 0,
    AETHERNET_NATIVE_STATUS_UNSUPPORTED = 1,
    AETHERNET_NATIVE_STATUS_CODEC_FAILURE = -1,
    AETHERNET_NATIVE_STATUS_DEADLINE_EXCEEDED = -2,
    AETHERNET_NATIVE_STATUS_WORK_LIMIT_EXCEEDED = -3,
    AETHERNET_NATIVE_STATUS_INVALID_DIMENSIONS = -4,
    AETHERNET_NATIVE_STATUS_OUTPUT_LIMIT_EXCEEDED = -5,
    AETHERNET_NATIVE_STATUS_ALLOCATION_FAILED = -6
};

int aethernet_monotonic_deadline_status(long long deadline_monotonic_ms);

extern const int aethernet_vips_format_uchar;
extern const int aethernet_vips_format_ushort;
extern const int aethernet_vips_format_float;

int aethernet_vips_init(const char *argv0);
void aethernet_vips_error_clear(void);
const char *aethernet_vips_error_buffer(void);
void aethernet_vips_tune_for_server(int per_pipeline_threads);
int aethernet_vips_probe_animated(const void *buf, size_t len, int *width, int *height, int *pages);
int aethernet_apng_probe(const void *buf, size_t len, int max_frames,
                      size_t max_total_pixels, int *width, int *height, int *frames);
VipsImage *aethernet_vips_image_new_from_buffer(const void *buf, size_t len, const char *option_string);
VipsImage *aethernet_vips_image_new_from_memory(const void *data, size_t size, int width, int height, int bands, int format);
VipsImage *aethernet_vips_image_new_from_memory_copy(const void *data, size_t size, int width, int height, int bands, int format);
int aethernet_vips_image_write_to_buffer(VipsImage *image, const char *suffix, void **buf, size_t *size);
int aethernet_vips_image_get_width(VipsImage *image);
int aethernet_vips_image_get_height(VipsImage *image);
int aethernet_vips_image_get_orientation_swap(VipsImage *image);
int aethernet_vips_image_get_bands(VipsImage *image);
int aethernet_vips_image_get_format(VipsImage *image);
int aethernet_vips_image_has_field(VipsImage *image, const char *field);
int aethernet_vips_image_get_int(VipsImage *image, const char *field, int *out);
void aethernet_vips_set_page_height(VipsImage *image, int page_height);
int aethernet_vips_set_animation_loop_count(VipsImage *image, int loop_count);
int aethernet_vips_read_delays_ms(VipsImage *image, int n_pages, int **out_delays, int *out_len);
int aethernet_vips_autorot(
    VipsImage *in, long long deadline_monotonic_ms, VipsImage **out);
int aethernet_vips_extract_area(VipsImage *in, VipsImage **out, int left, int top, int width, int height);
int aethernet_vips_resize(VipsImage *in, VipsImage **out, double scale);
int aethernet_vips_join_animation_pages(
    VipsImage *source, VipsImage **pages, int n_pages, int max_pages,
    size_t max_total_pixels, VipsImage **out);
int aethernet_vips_image_copy_memory(
    VipsImage *in, long long deadline_monotonic_ms, VipsImage **out);
#define AETHERNET_THUMB_CROP_NONE   0
#define AETHERNET_THUMB_CROP_CENTRE 1
int aethernet_vips_thumbnail_buffer_ex(
    const void *buf, size_t len, long long deadline_monotonic_ms,
    VipsImage **out, int width, int height,
    int n, int crop_mode, int max_pages, size_t max_total_pixels);
int aethernet_vips_image_to_rgba(VipsImage *in, VipsImage **out);
int aethernet_vips_extract_rgba(
    VipsImage *in, long long deadline_monotonic_ms,
    void **out_buf, size_t *out_size);
typedef int (*aethernet_vips_write_cb)(void *user_data, const void *bytes, size_t len);
int aethernet_vips_image_write_to_callback(
    VipsImage *image, const char *suffix, long long deadline_monotonic_ms,
    aethernet_vips_write_cb cb, void *user_data);
void aethernet_vips_unref(VipsImage *image);
void aethernet_vips_free(void *mem);
void aethernet_av_free(void *mem);
void aethernet_free_int_array(int *values);

int aethernet_heif_validate(
    const void *buf, size_t len, long long deadline_monotonic_ms);

struct aethernet_heif_primary_still_decode_facts {
    int hdr_tone_mapped;
    int hdr_gain_map_detected;
};

int aethernet_heif_decode_primary_still(
    const void *buf, size_t len, long long deadline_monotonic_ms,
    VipsImage **out, size_t max_pixels, int max_dimension,
    struct aethernet_heif_primary_still_decode_facts *facts);

int aethernet_ffmpeg_count_heif_sequence_frames(
    const void *heif_data,
    size_t heif_len,
    int decoder_threads,
    long long deadline_monotonic_ms,
    int max_frames,
    size_t max_total_pixels,
    int *out_frame_count
);

int aethernet_ffmpeg_decode_heif_sequence(
    const void *heif_data,
    size_t heif_len,
    int decoder_threads,
    long long deadline_monotonic_ms,
    VipsImage **out,
    int max_frames,
    size_t max_total_pixels,
    int *out_frame_count
);

int aethernet_ffmpeg_resize_gif(
    const void *gif_data,
    size_t gif_len,
    int decoder_threads,
    int target_width,
    int target_height,
    long long deadline_monotonic_ms,
    int max_source_frames,
    int max_encode_frames,
    int max_encode_duration_ms,
    size_t max_total_pixels,
    size_t max_output_size,
    void **out_buf,
    size_t *out_size,
    size_t *out_capacity
);

int aethernet_validate_gif_animation(
    const void *gif_data,
    size_t gif_len,
    int max_frames,
    int max_duration_ms,
    size_t max_total_pixels
);

int aethernet_ffmpeg_video_thumbnail_ex(
    const void *media_data,
    size_t media_len,
    int decoder_threads,
    long long deadline_monotonic_ms,
    const char *suffix,
    int max_packets,
    int max_width,
    int max_height,
    size_t max_output_size,
    int *out_display_width,
    int *out_display_height,
    void **out_buf,
    size_t *out_size,
    size_t *out_capacity
);

struct aethernet_av_metadata_out {
    int has_video;
    int has_audio;
    int frame_count;
    double duration_seconds;
    int display_width;
    int display_height;
    int rgba_width;
    int rgba_height;
    void *rgba;
    size_t rgba_size;
};

int aethernet_av_metadata(
    const void *media_data,
    size_t media_len,
    int decoder_threads,
    long long deadline_monotonic_ms,
    int max_packets,
    int max_width,
    int max_height,
    struct aethernet_av_metadata_out *out
);

int aethernet_ffmpeg_decode_apng(
    const void *apng_data,
    size_t apng_len,
    int decoder_threads,
    long long deadline_monotonic_ms,
    VipsImage **out,
    int max_frames,
    size_t max_total_pixels,
    int require_complete,
    uint32_t *out_num_plays
);

int aethernet_ffmpeg_decode_bmp(
    const void *bmp_data,
    size_t bmp_len,
    int decoder_threads,
    long long deadline_monotonic_ms,
    VipsImage **out,
    size_t max_total_pixels
);

struct aethernet_webp_anim_limits {
    int max_frames;
    int max_duration_ms;
    long long deadline_monotonic_ms;
};

int aethernet_webp_encode_animated(
    VipsImage *image,
    int quality,
    int lossless,
    int effort,
    int alpha_q,
    int smart_subsample,
    int thread_level,
    int loop_count,
    int full_canvas_frames,
    const struct aethernet_webp_anim_limits *limits,
    size_t max_output_size,
    void **out_buf,
    size_t *out_size
);

int aethernet_webp_transform_animated(
    const void *webp_data,
    size_t webp_len,
    int max_width,
    int max_height,
    int quality,
    int lossless,
    int effort,
    int alpha_q,
    int smart_subsample,
    int thread_level,
    int max_source_frames,
    size_t max_total_pixels,
    const struct aethernet_webp_anim_limits *limits,
    size_t max_output_size,
    void **out_buf,
    size_t *out_size
);

void aethernet_webp_free(void *mem);

struct aethernet_nsfw_frame_out {
    void *data;
    size_t len;
};

int aethernet_ffmpeg_extract_apng_frames_for_nsfw(
    const void *apng_data,
    size_t apng_len,
    int decoder_threads,
    long long deadline_monotonic_ms,
    const int *frame_indices,
    size_t n_indices,
    int max_frames,
    size_t max_total_pixels,
    size_t max_frame_output_size,
    struct aethernet_nsfw_frame_out *out_frames
);

int aethernet_ffmpeg_extract_gif_frames_for_nsfw(
    const void *gif_data,
    size_t gif_len,
    int decoder_threads,
    long long deadline_monotonic_ms,
    const int *frame_indices,
    size_t n_indices,
    int max_frames,
    size_t max_total_pixels,
    size_t max_frame_output_size,
    struct aethernet_nsfw_frame_out *out_frames
);

int aethernet_webp_extract_frames_for_nsfw(
    const void *webp_data,
    size_t webp_len,
    int thread_level,
    long long deadline_monotonic_ms,
    const int *frame_indices,
    size_t n_indices,
    int max_frames,
    size_t max_total_pixels,
    size_t max_frame_output_size,
    struct aethernet_nsfw_frame_out *out_frames
);

int aethernet_av_extract_frames_for_nsfw(
    const void *media_data,
    size_t media_len,
    int decoder_threads,
    long long deadline_monotonic_ms,
    const double *timestamps_secs,
    size_t n_timestamps,
    size_t max_frame_output_size,
    struct aethernet_nsfw_frame_out *out_frames
);

void aethernet_nsfw_frames_free(struct aethernet_nsfw_frame_out *frames, size_t n);

#ifdef __cplusplus
}
#endif
