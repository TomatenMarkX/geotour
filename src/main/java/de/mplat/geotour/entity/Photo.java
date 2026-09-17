package de.mplat.geotour.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "photos")
public class Photo {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "tour_id")
    private Tour tour;

    @Column(unique = true,  nullable = false)
    private String filename;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    @Column
    private Long filesize;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Photo() {}

    public Photo(Tour tour, String filename, double lat, double lng, Long filesize) {
        this.tour = tour;
        this.filename = filename;
        this.lat = lat;
        this.lng = lng;
        this.filesize = filesize;
    }

    public Tour getTour() {
        return tour;
    }

    public String getFilename() {
        return filename;
    }

    public double getLat() {
        return lat;
    }

    public double getLng() {
        return lng;
    }

    public Long getFilesize() {
        return filesize;
    }

    public Instant getTimestamp() {
        return createdAt;
    }

    public UUID getId() {
        return id;
    }
}
