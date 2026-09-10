package de.mplat.geotour.controller;

import de.mplat.geotour.entity.Tour;
import de.mplat.geotour.entity.TourRepository;
import de.mplat.geotour.entity.User;
import de.mplat.geotour.entity.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import javax.management.ConstructorParameters;
import java.net.URI;
import java.util.List;
import java.util.UUID;

@Controller
@RequestMapping("/tours")
public class TourController {
    private final UserRepository userRepository;
    private final TourRepository tourRepository;

    public TourController(UserRepository userRepository, TourRepository tourRepository) {
        this.userRepository = userRepository;
        this.tourRepository = tourRepository;
    }

    @PostMapping("/{tourId}/photos/upload-urls")
    public ResponseEntity<Void> uploadPhoto(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @RequestBody UploadUrlRequest request) {

        return ResponseEntity.ok().build();
    }

    @PostMapping
    public ResponseEntity<TourResponse> createTour(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateTourRequest request) {
        User user = userRepository.getReferenceById(userIdOf(jwt));
        Tour tour = tourRepository.save(new Tour(user, request.name(), false));
        return ResponseEntity.created(URI.create("/tours/" + tour.getId())).body(new TourResponse(tour.getId(), tour.getName()));
    }

    private UUID userIdOf(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    public record CreateTourRequest(@NotBlank @Size(max = 200) String name) {}
    public record TourResponse(UUID id, String name) {}
    public record UploadUrlRequest(@NotEmpty @Size(max = 50) List<@NotBlank String> filenames) {}
}
