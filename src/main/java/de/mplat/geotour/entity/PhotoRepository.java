package de.mplat.geotour.entity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import javax.swing.text.html.Option;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PhotoRepository extends JpaRepository<Photo, UUID> {
    List<Photo> findByTourId(UUID tourId);

    List<Photo> findByTourIdOrderByCreatedAtAsc(UUID tourId);

    Optional<Photo> findByFilename(String filename);

    long countByTourId(UUID tourId);

    @Query("select max(p.position) from Photo p where p.tour.id = :tourId")
    Optional<Integer> findMaxPositionByTourId(UUID tourId);
}
