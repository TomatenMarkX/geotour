package de.mplat.geotour.entity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TourRepository extends JpaRepository<Tour, UUID> {
    Optional<Tour> findById(UUID id);
    List<Tour> findByOwner_id(UUID owner_id);
    Optional<Tour> findByName(String name);
    Optional<Tour> findByShareToken(UUID shareToken);
}
