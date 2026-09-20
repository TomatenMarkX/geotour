# ── Build ────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:25-jdk-alpine AS builder

# Der Wrapper läuft mit distributionType=only-script, lädt Maven 3.9.16 also
# beim Build selbst herunter und entpackt es — dafür braucht er curl und unzip.
RUN apk add --no-cache curl unzip

WORKDIR /app

# Erst nur das, was die Abhängigkeiten bestimmt — so bleibt der Layer-Cache
# gültig, solange sich die pom.xml nicht ändert.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY src ./src
RUN ./mvnw -B -q clean package -DskipTests

# ── Laufzeit ─────────────────────────────────────────────────────────────────
FROM eclipse-temurin:25-jre-alpine

RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
