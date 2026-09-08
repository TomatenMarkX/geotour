package de.mplat.geotour.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name="email", nullable = false)
    private String email;

    @Column(name="created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name="google_sub", nullable = false, unique = true)
    private String googleSub;

    public User() {}

    public User(String google_sub, String email) {
        this.email = email;
        this.googleSub = google_sub;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getGoogleSub() {
        return googleSub;
    }
}
