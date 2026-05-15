# Stage 1: Build - Use Maven to package the application
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app
# Only copy pom.xml to cache dependencies
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn dependency:resolve -B
# Build the application
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn package -DskipTests

# Stage 2: Extract - Use Spring Boot's layertools to separate dependencies
FROM eclipse-temurin:21-jre-alpine AS extractor
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# Stage 3: Run - Final lightweight image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy layers from extractor stage. Order matters for caching: 
# least changed (dependencies) to most changed (application)
COPY --from=extractor /app/dependencies/ ./
COPY --from=extractor /app/spring-boot-loader/ ./
COPY --from=extractor /app/snapshot-dependencies/ ./
COPY --from=extractor /app/application/ ./

ENV SPRING_PROFILES_ACTIVE=prod
EXPOSE 8080

# Use JarLauncher to start the application (native Spring Boot layered entrypoint)
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
