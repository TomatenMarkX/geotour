package de.mplat.geotour.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

@Service
public class StorageService {
    private final S3Presigner s3Presigner;
    private final String bucket;
    private final Duration duration;

    public StorageService(S3Presigner s3Presigner, @Value("${app.storage.bucket}") String bucket, @Value("${app.storage.duration}") Duration duration) {
        this.s3Presigner = s3Presigner;
        this.bucket = bucket;
        this.duration = duration;
    }

    public PresignedUpload presignedUpload(String originalName) {
        String key = "/staging" + UUID.randomUUID().toString() + extensionOf(originalName);
        var request = PutObjectPresignRequest.builder().signatureDuration(duration).putObjectRequest(r -> r.bucket(bucket).key(key)).build();
        return new PresignedUpload(originalName, key, s3Presigner.presignPutObject(request).toString());
    }

    private String extensionOf(String name) {
        if (name == null) return "";
        return name.contains(".") ? name.substring(name.lastIndexOf(".")).toLowerCase() : "";
    }

    private record PresignedUpload(String originalName, String key, String url) {}
}
