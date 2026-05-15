# Build stage
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app

# NO ALIYUN MIRROR HERE - GitHub Runners are in US/EU, 
# default Maven Central is much faster for them.

# Copy pom.xml first to resolve dependencies
COPY pom.xml .
RUN mvn dependency:resolve -B

# Copy source and build
COPY src ./src
RUN mvn package -DskipTests

# Run stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy dependencies first (these change rarely)
COPY --from=build /app/target/lib ./lib
# Copy the thin jar
COPY --from=build /app/target/*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=prod

EXPOSE 8080
# Run with classpath including lib folder
ENTRYPOINT ["java", "-cp", "app.jar:lib/*", "com.caius.agent.JavaBackendApplication"]
