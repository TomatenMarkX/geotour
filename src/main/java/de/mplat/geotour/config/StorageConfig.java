package de.mplat.geotour.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
public class StorageConfig {

    private final URI endpoint;
    private final Region region;
    private final StaticCredentialsProvider credentials;
    private final S3Configuration s3Config =
            S3Configuration.builder().pathStyleAccessEnabled(true).build();

    public StorageConfig(@Value("${app.storage.endpoint}") String endpoint,
                         @Value("${app.storage.region}") String region,
                         @Value("${app.storage.key-id}") String keyId,
                         @Value("${app.storage.app-key}") String appKey) {
        this.endpoint = URI.create(endpoint);
        this.region = Region.of(region);
        this.credentials = StaticCredentialsProvider.create(AwsBasicCredentials.create(keyId, appKey));
    }

    @Bean
    S3Presigner s3Presigner() {
        return S3Presigner.builder()
                .endpointOverride(endpoint).region(region)
                .credentialsProvider(credentials).serviceConfiguration(s3Config)
                .build();
    }

    @Bean
    S3Client s3Client() {
        return S3Client.builder()
                .endpointOverride(endpoint).region(region)
                .credentialsProvider(credentials).serviceConfiguration(s3Config)
                .build();
    }
}
