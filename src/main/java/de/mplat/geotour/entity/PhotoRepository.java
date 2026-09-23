package de.mplat.geotour.entity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("select p.storageKey from Photo p where p.tour.id = :tourId")
    List<String> findStorageKeysByTourId(UUID tourId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Photo p set p.position = p.position + :count where p.tour.id = :tourId and p.position >= :from")
    int shiftPositions(@Param("tourId") UUID tourId, @Param("from") int from, @Param("count") int count);
}
