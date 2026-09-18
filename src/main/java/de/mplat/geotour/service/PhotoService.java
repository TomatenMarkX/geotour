package de.mplat.geotour.service;

import de.mplat.geotour.entity.Photo;
import de.mplat.geotour.entity.PhotoRepository;
import de.mplat.geotour.entity.Tour;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
public class PhotoService {
    private final StorageService storageService;
    private final PhotoRepository photoRepository;

    public PhotoService(StorageService storageService, PhotoRepository photoRepository) {
        this.storageService = storageService;
        this.photoRepository = photoRepository;
    }

    public List<Photo> register(@NotNull List<PhotoRegistration> photos, @NotNull Tour tour) {
        Map<String, Long> filesizes = new HashMap<>();
        List<String> invalid = new ArrayList<>();
        for (PhotoRegistration photo : photos) {
            Optional<Long> size = storageService.isStagingKey(photo.key()) && !filesizes.containsKey(photo.key())
                    ? storageService.sizeOf(photo.key())
                    : Optional.empty();
            size.ifPresentOrElse(s -> filesizes.put(photo.key(), s), () -> invalid.add(photo.key()));
        }
        if(!invalid.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, "Ungültige Uploads oder Duplikate: " + invalid);
        }
        List<String> promoted = new ArrayList<>();
        int offset = photoRepository.findMaxPositionByTourId(tour.getId()).orElse(-1) + 1;
        try {
            List<Photo> items = new ArrayList<>();
            for (int index = 0; index < photos.size(); index++) {
                PhotoRegistration photo = photos.get(index);
                String targetKey = storageService.promote(photo.key(), tour.getId());
                promoted.add(targetKey);
                items.add(new Photo(tour, targetKey, photo.lat(), photo.lng(), filesizes.get(photo.key()), offset + index));
            }
            return photoRepository.saveAll(items);
        } catch (RuntimeException e) {
            promoted.forEach(storageService::deleteQuietly);
            throw e;
        }
    }

    public record PhotoRegistration(@NotNull String key, @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat, @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng){};
}
