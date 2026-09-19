package de.mplat.geotour.entity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PhotoRepository extends JpaRepository<Photo, UUID> {
    List<Photo> findByTourId(UUID tourId);

    Optional<Photo> findByStorageKey(String storageKey);

    Optional<Photo> findByTourIdAndId(UUID tourId, UUID photoId);

    long countByTourId(UUID tourId);

    @Query("select max(p.position) from Photo p where p.tour.id = :tourId")
    Optional<Integer> findMaxPositionByTourId(UUID tourId);
}
