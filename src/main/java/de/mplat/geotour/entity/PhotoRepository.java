package de.mplat.geotour.entity;

import org.springframework.data.jpa.repository.JpaRepository;

import javax.swing.text.html.Option;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PhotoRepository extends JpaRepository<Photo, UUID> {
    List<Photo> findByTourId(UUID tourId);

    List<Photo> findByTourIdOrderByCreatedAtAsc(UUID tourId);

    Optional<Photo> findByFilename(String filename);

    long countByTourId(UUID tourId);
}
