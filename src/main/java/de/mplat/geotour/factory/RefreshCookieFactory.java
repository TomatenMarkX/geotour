package de.mplat.geotour.factory;

import de.mplat.geotour.service.RefreshTokenService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class RefreshCookieFactory {
    private static final String REFRESH_COOKIE_NAME = "refresh_token";
    private final boolean secure;

    public RefreshCookieFactory(@Value("${app.cookie-secure}") boolean secure) {
        this.secure = secure;
    }

    public ResponseCookie create(String refreshToken) {
        return base(refreshToken).maxAge(RefreshTokenService.REFRESH_TOKEN_VALIDITY).build();
    }

    public ResponseCookie delete() {
        return base("").maxAge(0).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String refreshToken) {
        return
                ResponseCookie.from(REFRESH_COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax").path("/auth");
    }
}
