package de.mplat.geotour.entity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TourRepository extends JpaRepository<Tour, UUID> {
    Optional<Tour> findById(UUID id);
    List<Tour> findByOwner_id(UUID owner_id);
    Optional<Tour> findByName(String name);
    @Query("select t from Tour t left join fetch t.photos where t.shareToken = :token")
    Optional<Tour> findByShareTokenWithPhotos(@Param("token") UUID token);
    Optional<Tour> findByIdAndOwner_Id(UUID id, UUID ownerId);
}
