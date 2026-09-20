# GeoTour Frontend — Setup

## 1. Starten

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc --noEmit && vite build -> dist/
```

`.env.development` setzt `VITE_API_URL=http://localhost:8080`. Für Produktion `.env.production`
aus `.env.example` anlegen — Backend möglichst unter demselben Host ausliefern (z. B. `/api`),
damit das Refresh-Cookie mit `SameSite=Lax` mitgeht.

## 2. shadcn/ui-Komponenten nachziehen

`components.json` liegt bereit, die Komponenten selbst nicht (die kopiert der CLI ins Projekt):

```bash
npx shadcn@latest add button scroll-area separator dialog input label switch \
  dropdown-menu alert-dialog progress tooltip
```

## 3. Was das Backend dafür braucht

`src/main/resources/application.properties` ist gitignored. Benötigte Keys:

```properties
app.frontend.url=http://localhost:5173
app.cookie-secure=false
app.jwt.secret=<mind. 32 Zeichen>
app.storage.endpoint=https://s3.<region>.backblazeb2.com
app.storage.region=<region>
app.storage.bucket=<bucket>
app.storage.key-id=<keyId>
app.storage.app-key=<applicationKey>
app.storage.upload.duration=PT10M
app.storage.download.duration=PT1H

spring.security.oauth2.client.registration.google.client-id=...
spring.security.oauth2.client.registration.google.client-secret=...
spring.datasource.url=jdbc:postgresql://localhost:5432/geotour
spring.datasource.username=geotour
spring.datasource.password=geotourpasswd
```

Google Cloud Console → Authorized redirect URI:
`http://localhost:8080/login/oauth2/code/google`

CORS am Bucket (B2/R2) muss `PUT` von `http://localhost:5173` erlauben, sonst schlägt der
direkte Upload auf die presigned URL im Browser fehl.

## 4. Offene Punkte im Backend

1. **`CorsConfig` wird nicht geladen** — der Klasse fehlt `@Configuration` (oder
   `@Component`). Ohne die Bean gibt `cors(Customizer.withDefaults())` keine
   `CorsConfigurationSource` her, es kommen keine CORS-Header, und jeder Request von
   `:5173` nach `:8080` scheitert im Preflight. Blockiert das Frontend sofort.
2. **`POST /auth/logout` hat keinen Handler** — die Route steht im `securityMatcher` von
   Chain 1, aber `AuthController` hat nur `/refresh`. Nötig: Refresh-Token serverseitig
   revoken (`revoked_at` setzen) und das Cookie über `RefreshCookieFactory.delete()`
   löschen. Aktuell verwirft das Frontend die Session nur lokal.
3. **Fotos einer eigenen Tour sind nicht abrufbar** — `GET /tours` liefert nur
   `TourSummary` ohne Fotos, `POST /tours/verify` greift nur bei öffentlichen Touren.
   Für die Besitzer-Ansicht fehlt `GET /tours/{tourId}/photos`, das `PublicPhotos`
   (inkl. presigned Download-URL) zurückgibt. `tourService.loadTourPhotos()` ruft diesen
   Pfad schon auf und läuft, sobald er existiert.

Kleinere Punkte: `Tour.photos` sortiert per `@OrderBy("createdAt ASC")`, obwohl es die
Spalte `position` gibt — besser `@OrderBy("position ASC")`. `TourService` ist leer.

## 5. Was sich gegenüber dem alten Frontend geändert hat

| alt (Supabase/Ktor) | neu (Spring Boot) |
| --- | --- |
| `supabase.auth` + `useAuth` mit `getAccessToken()` | `AuthProvider` hält den Access Token im Speicher, Silent Refresh über `/auth/refresh` |
| Token als Prop durch die Komponenten gereicht | kein Token in der UI mehr; `apiFetch` hängt den Header selbst an |
| `fetchImageBlob()` lädt Bilder mit Bearer-Header als Blob | Fotos kommen als presigned URL, direkt in `<img src>` |
| `POST /upload` mit `FormData` durchs Backend | `upload-urls` → `PUT` in den Bucket → `POST /tours/{id}/photos` |
| `supabase.from("tours")…` | `tourService`-Funktionen gegen `/tours/**` |
| snake_case (`is_public`, `share_token`) | camelCase (`isPublic`, `shareToken`) |
| `ImageFile` mischt `File` und Remote-Foto | `PendingImage` (lokal) vs. `TourPhoto` (remote) |

Die alten Komponenten (`TourSideBar`, `TourImageSideBar`, `TourDialog`,
`TourSettingsDialog`, `TourViewer`, `Viewer360`, `NoActiveUserView`, `useResizableSidebar`)
sind noch nicht portiert. Sie brauchen im Wesentlichen drei Anpassungen:
`ImageFile` → `PendingImage`/`TourPhoto`, snake_case → camelCase, und das `token`-Prop
entfällt. `src/App.tsx` ist derzeit eine lauffähige Hülle, die den Pfad
Login → Tour anlegen → Upload → Teilen einmal durchspielt — dort kommt die alte UI rein.
