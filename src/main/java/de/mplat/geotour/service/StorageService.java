package de.mplat.geotour.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class StorageService {
    private static final String STAGING_PREFIX = "staging/";
    private static final Pattern STAGING_PATTERN = Pattern.compile("^staging/[0-9a-f-]{36}(\\.[a-z0-9]{1,10})?$");

    private final S3Presigner s3Presigner;
    private final S3Client s3Client;
    private final String bucket;
    private final Duration duration;
    private final Logger logger = LoggerFactory.getLogger(StorageService.class);

    public StorageService(S3Presigner s3Presigner, S3Client s3client, @Value("${app.storage.bucket}") String bucket, @Value("${app.storage.duration}") Duration duration) {
        this.s3Presigner = s3Presigner;
        this.s3Client = s3client;
        this.bucket = bucket;
        this.duration = duration;
    }

    public PresignedUpload presignedUpload(String originalName) {
        String key = "staging/" + UUID.randomUUID().toString() + extensionOf(originalName);
        var request = PutObjectPresignRequest.builder().signatureDuration(duration).putObjectRequest(r -> r.bucket(bucket).key(key)).build();
        return new PresignedUpload(originalName, key, s3Presigner.presignPutObject(request).url().toString());
    }

    public boolean isStagingKey(String key) {
        return key != null && STAGING_PATTERN.matcher(key).matches();
    }

    public Optional<Long> sizeOf(String key) {
        try {
            return Optional.of(s3Client.headObject(r -> r.bucket(bucket).key(key)).contentLength());
        }
        catch (Exception e) {
            logger.warn("Failed to get size of key {}", key, e);
            return Optional.empty();
        }
    }

    public String promote(String stagingKey, UUID tourId) {
        String targetKey = "target/" + tourId + "/" + stagingKey.substring(STAGING_PREFIX.length());
        s3Client.copyObject(builder -> builder.sourceBucket(bucket).sourceKey(stagingKey).destinationBucket(bucket).destinationKey(targetKey));
        return targetKey;
    }

    public void deleteQuietly(String key) {
        try {
            s3Client.deleteObject(builder -> builder.bucket(bucket).key(key));
        }
        catch (RuntimeException e) {
            logger.warn("Konnte {} nicht löschen", key, e);
        }
    }

    private String extensionOf(String name) {
        if (name == null) return "";
        return name.contains(".") ? name.substring(name.lastIndexOf(".")).toLowerCase() : "";
    }

    public record PresignedUpload(String originalName, String key, String url) {}
}
