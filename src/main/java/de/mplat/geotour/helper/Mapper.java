package de.mplat.geotour.helper;


import de.mplat.geotour.controller.TourController;
import de.mplat.geotour.entity.Photo;
import de.mplat.geotour.service.StorageService;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class Mapper {
    private final StorageService storageService;
    public Mapper(StorageService storageService) {
        this.storageService = storageService;
    }

    public List<TourController.PublicPhotos> mapPhotosToPublicPhotos(List<Photo> photos) {
        return photos.stream().map(photo -> new TourController.PublicPhotos(photo.getId(), photo.getPosition(), photo.getLat(), photo.getLng(), storageService.presignedDownload(photo.getStorageKey()))).toList();
    }

    public List<TourController.TourSummary> mapToursToTourSummary(List<de.mplat.geotour.entity.Tour> tours) {
        return tours.stream().map(tour -> new TourController.TourSummary(tour.getId(), tour.getName(), tour.isPublic(), tour.getShareToken(), tour.getPasswordHash() != null, tour.getCreatedAt())).toList();
    }
}
