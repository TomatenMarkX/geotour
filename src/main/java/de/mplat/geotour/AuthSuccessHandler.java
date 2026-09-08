package de.mplat.geotour;

import de.mplat.geotour.entity.User;
import de.mplat.geotour.entity.UserRepository;
import de.mplat.geotour.factory.RefreshCookieFactory;
import de.mplat.geotour.service.RefreshTokenService;
import de.mplat.geotour.service.TokenService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Duration;
import java.util.Optional;

@Component
public class AuthSuccessHandler implements AuthenticationSuccessHandler {
    private static final Logger logger = LoggerFactory.getLogger(AuthSuccessHandler.class);
    private final UserRepository userRepository;
    private final TokenService tokenService;
    private final RefreshTokenService refreshTokenService;
    private final String frontendUrl;
    private final RefreshCookieFactory refreshCookieFactory;
    private final boolean cookieSecure;

    public AuthSuccessHandler(UserRepository userRepository, TokenService tokenService, RefreshTokenService refreshTokenService, @Value("${app.frontend.url}") String frontendUrl, @Value("${app.cookie-secure}") boolean cookieSecure, RefreshCookieFactory refreshCookieFactory) {
        this.userRepository = userRepository;
        this.tokenService = tokenService;
        this.refreshTokenService = refreshTokenService;
        this.frontendUrl = frontendUrl;
        this.cookieSecure = cookieSecure;
        this.refreshCookieFactory = refreshCookieFactory;
    }


    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        if(!(authentication.getPrincipal() instanceof OidcUser oidcUser)) {
            throw new IllegalStateException("Erwartet OidcUser, war: " + authentication.getPrincipal().getClass());
        }

        Optional<User> existing = userRepository.findByGoogleSub(oidcUser.getSubject());
        User user = existing.orElseGet(() -> userRepository.save(new User(oidcUser.getSubject(), oidcUser.getEmail())));

        String accessToken = tokenService.createAccessToken(user);
        String refreshToken = refreshTokenService.createRefreshToken(user);

        ResponseCookie cookie = refreshCookieFactory.create(refreshToken);
        
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        response.sendRedirect(frontendUrl + "/auth/callback#token=" + accessToken);
    }
}
