package de.mplat.geotour.controller;

import de.mplat.geotour.entity.*;
import de.mplat.geotour.helper.Mapper;
import de.mplat.geotour.service.PhotoService;
import de.mplat.geotour.service.StorageService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/tours")
public class TourController {
    private final UserRepository userRepository;
    private final TourRepository tourRepository;
    private final StorageService storageService;
    private final PhotoService photoService;
    private final PasswordEncoder encoder;
    private final Mapper mapper;
    private final PhotoRepository photoRepository;

    public TourController(UserRepository userRepository, TourRepository tourRepository, StorageService storageService, PhotoService photoService, PasswordEncoder encoder, Mapper mapper, PhotoRepository photoRepository) {
        this.userRepository = userRepository;
        this.tourRepository = tourRepository;
        this.storageService = storageService;
        this.photoService = photoService;
        this.encoder = encoder;
        this.mapper = mapper;
        this.photoRepository = photoRepository;
    }

    @PostMapping("/{tourId}/photos/upload-urls")
    public List<StorageService.PresignedUpload> uploadPhoto(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @Valid @RequestBody UploadUrlRequest request) {
        requireOwnerTour(tourId, jwt);
        return request.filenames().stream().map((filename) -> storageService.presignedUpload(filename)).toList();
    }

    @PostMapping("/{tourId}/photos")
    public ResponseEntity<List<PhotoResponse>> registerPhoto(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @Valid @RequestBody RegisterPhotoRequest request) {
        try {
            List<Photo> promotedPhotos = photoService.register(request.photos(), requireOwnerTour(tourId, jwt));
            List<PhotoResponse> responses = promotedPhotos.stream().map(photo -> new PhotoResponse(photo.getId(), photo.getStorageKey(), photo.getLat(), photo.getLng())).toList();
            return ResponseEntity.status(HttpStatus.CREATED).body(responses);
        }
        catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }

    @GetMapping
    public ResponseEntity<UserTourResponse> getUserTours(@AuthenticationPrincipal Jwt jwt) {
        List<Tour> tours = tourRepository.findByOwner_id(UUID.fromString(Objects.requireNonNull(jwt.getSubject())));
        return ResponseEntity.ok(new UserTourResponse(jwt.getSubject(), mapper.mapToursToTourSummary(tours)));
    }

    @Transactional(readOnly = true)
    @PostMapping("/verify")
    public ResponseEntity<?> verifyTour(@Valid @RequestBody VerifyTourRequest request) {
        Optional<Tour> tour = tourRepository.findByShareTokenWithPhotos(request.shareToken());

        if (tour.isEmpty() || !tour.get().isPublic()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
        }

        String hash = tour.get().getPasswordHash();

        if (hash != null) {
            String pw = request.password();
            boolean providedPw = pw != null && !pw.isBlank();
            if (!providedPw || !encoder.matches(pw, hash)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new NeedsPasswordResponse(true, true));
            }
        }
        List<Photo> photos = tour.get().getPhotos();

        return ResponseEntity.status(HttpStatus.OK).body(
                new PublicTourResponse(
                        tour.get().getId(),
                        tour.get().getName(),
                        mapper.mapPhotosToPublicPhotos(photos)));
    }

    @PutMapping("/{tourId}/privacy")
    public ShareResponse changeTourPrivacy(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @Valid @RequestBody ChangePrivacyRequest request) {
        Tour tour = requireOwnerTour(tourId, jwt);
        tour.setPublic(request.isPublic());
        if (request.isPublic() && tour.getShareToken() == null) {
            tour.setShareToken(UUID.randomUUID());
            return new ShareResponse(true, tour.getShareToken());
        }
        tour.setShareToken(null);
        return new ShareResponse(request.isPublic(), tour.getShareToken());
    }

    @PostMapping("/{tourId}/privacy/rotate")
    @Transactional
    public ShareResponse rotateShareToken(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId) {
        Tour tour = requireOwnerTour(tourId, jwt);
        tour.setShareToken(UUID.randomUUID());
        return new ShareResponse(tour.isPublic(), tour.getShareToken());
    }

    @PostMapping
    public ResponseEntity<TourResponse> createTour(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateTourRequest request) {
        User user = userRepository.getReferenceById(userIdOf(jwt));
        Tour tour = tourRepository.save(new Tour(user, request.name(), false));
        return ResponseEntity.created(URI.create("/tours/" + tour.getId())).body(new TourResponse(tour.getId(), tour.getName()));
    }

    @DeleteMapping("/{tourId}")
    @Transactional
    public ResponseEntity<Void> deleteTour(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId) {
        Tour tour = requireOwnerTour(tourId, jwt);
        List<String> keys = tour.getPhotos().stream().map(Photo::getStorageKey).toList();
        tourRepository.delete(tour);
        storageService.deleteQuietly(keys);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{tourId}/photos/{photoId}")
    @Transactional
    public ResponseEntity<Void> deletePhoto(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @PathVariable("photoId") UUID photoId) {
        Tour tour = requireOwnerTour(tourId, jwt);
        Photo photo = photoRepository.findByTourIdAndId(photoId, tourId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        photoRepository.delete(photo);
        storageService.deleteQuietly(photo.getStorageKey());
        return ResponseEntity.noContent().build();
    }


    @PutMapping("/{tourId}/password")
    @Transactional
    public ResponseEntity<Void> changeTourPassword(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @Valid @RequestBody SetPasswordRequest request) {
        Tour tour = requireOwnerTour(tourId, jwt);
        String password = request.password();
        tour.setPasswordHash((password == null || password.isBlank()) ? null : encoder.encode(password));
        tourRepository.save(tour);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{tourId}/name")
    public ResponseEntity<Void> changeTourName (@AuthenticationPrincipal Jwt jwt, @PathVariable ("tourId") UUID tourId, @Valid @RequestBody SetNameRequest request) {
        Tour tour = requireOwnerTour(tourId, jwt);
        tour.setName(request.name());
        tourRepository.save(tour);
        return ResponseEntity.noContent().build();
    }

    private UUID userIdOf(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private Tour requireOwnerTour(UUID tourId, Jwt jwt) {
        return tourRepository.findByIdAndOwner_Id(tourId, userIdOf(jwt)).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    public record CreateTourRequest(@NotBlank @Size(max = 200) String name) {}
    public record TourResponse(UUID id, String name) {}
    public record UploadUrlRequest(@NotEmpty @Size(max = 50) List<@NotBlank String> filenames) {}
    public record RegisterPhotoRequest(@NotEmpty List<PhotoService.PhotoRegistration> photos) {}
    public record PhotoResponse(UUID id, String key, double lat, double lng) {}
    public record SetPasswordRequest(String password) {}
    public record VerifyTourRequest(@NotNull UUID shareToken, String password) {}
    public record NeedsPasswordResponse(boolean needsPassword, boolean wrong) {}
    public record PublicTourResponse(UUID id, String name, List<PublicPhotos> photos){}
    public record PublicPhotos(UUID id, int position, double lat, double lng, String url){}
    public record ChangePrivacyRequest(@NotNull boolean isPublic) {}
    public record ShareResponse(boolean isPublic, UUID shareToken) {}
    public record SetNameRequest(@NotBlank @Size(max = 200) String name) {}
    public record UserTourResponse(String userId, List<TourSummary> tours) {}
    public record TourSummary(UUID id, String name, boolean isPublic,  UUID shareToken, boolean hasPassword, Instant createdAt) {}
}