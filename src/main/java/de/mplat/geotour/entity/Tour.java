package de.mplat.geotour.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "tours")
public class Tour {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(nullable = false)
    private String name;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic;

    @OneToMany(mappedBy = "tour", fetch = FetchType.LAZY)
    @OrderBy("createdAt ASC")
    private List<Photo> photos = new ArrayList<>();

    @Column(name = "share_token", unique = true)
    private UUID shareToken;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Tour() {}

    public Tour(User owner, String name, boolean isPublic) {
        this.owner = owner;
        this.name = name;
        this.isPublic = isPublic;
    }

    public UUID getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public boolean isPublic() {
        return isPublic;
    }

    public void setPublic(boolean isPublic) {
        this.isPublic = isPublic;
    }

    public UUID getShareToken() {
        return shareToken;
    }

    public void setShareToken(UUID shareToken) {
        this.shareToken = shareToken;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<Photo> getPhotos() {
        return photos;
    }
}
