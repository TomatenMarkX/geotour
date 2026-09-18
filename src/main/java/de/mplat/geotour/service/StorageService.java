package de.mplat.geotour.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.List;
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
    private final Duration uploadDuration;
    private final Duration downloadDuration;
    private final Logger logger = LoggerFactory.getLogger(StorageService.class);

    public StorageService(S3Presigner s3Presigner, S3Client s3client, @Value("${app.storage.bucket}") String bucket, @Value("${app.storage.upload.duration}") Duration uploadDuration, @Value("${app.storage.download.duration}") Duration downloadDuration) {
        this.s3Presigner = s3Presigner;
        this.s3Client = s3client;
        this.bucket = bucket;
        this.uploadDuration = uploadDuration;
        this.downloadDuration = downloadDuration;
    }

    public PresignedUpload presignedUpload(String originalName) {
        String key = "staging/" + UUID.randomUUID().toString() + extensionOf(originalName);
        var request = PutObjectPresignRequest.builder().signatureDuration(uploadDuration).putObjectRequest(r -> r.bucket(bucket).key(key)).build();
        return new PresignedUpload(originalName, key, s3Presigner.presignPutObject(request).url().toString());
    }

    public String presignedDownload(String key) {
        var request = GetObjectPresignRequest.builder().signatureDuration(downloadDuration).getObjectRequest(r -> r.bucket(bucket).key(key)).build();
        return s3Presigner.presignGetObject(request).url().toString();
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

    public void deleteQuietly(List<String> keys) {
        if (keys == null || keys.isEmpty()) return;
        for (int from = 0; from <= keys.size(); from += 1000) {
            List<ObjectIdentifier> identifiers = keys.subList(from, Math.min(from + 1000, keys.size())).stream().map(
                    key -> ObjectIdentifier.builder().key(key).build()
            ).toList();
            try {
                DeleteObjectsResponse response = s3Client.deleteObjects(builder -> builder.bucket(bucket).delete(d -> d.objects(identifiers).quiet(true)));
                if (response.hasErrors()) {
                    response.errors().forEach(error -> logger.warn("Konnte {} nicht löschen: {}", error.key(), error.code()));
                } else {
                    logger.info("Löschvorgang erfolgreich");
                }
            }
            catch (RuntimeException e) {
                logger.warn("Konnte {} nicht löschen", keys, e);
            }

        }
    }

    private String extensionOf(String name) {
        if (name == null) return "";
        return name.contains(".") ? name.substring(name.lastIndexOf(".")).toLowerCase() : "";
    }

    public record PresignedUpload(String originalName, String key, String url) {}
}
