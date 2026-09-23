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

    @Column(name = "storage_key", unique = true,  nullable = false)
    private String storageKey;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    @Column
    private Long filesize;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Photo() {}

    public Photo(Tour tour, String storageKey, double lat, double lng, Long filesize, int position) {
        this.tour = tour;
        this.storageKey = storageKey;
        this.lat = lat;
        this.lng = lng;
        this.filesize = filesize;
        this.position = position;
    }

    public Tour getTour() {
        return tour;
    }

    public String getStorageKey() {
        return storageKey;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public UUID getId() {
        return id;
    }
}
