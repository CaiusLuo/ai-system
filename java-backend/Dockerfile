# Build stage
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Use Aliyun Maven Mirror for faster dependency download
RUN mkdir -p /root/.m2
RUN echo '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd"><mirrors><mirror><id>aliyunmaven</id><mirrorOf>*</mirrorOf><name>Aliyun Maven</name><url>https://maven.aliyun.com/repository/public</url></mirror></mirrors></settings>' > /root/.m2/settings.xml

# Copy pom.xml first to cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src ./src
RUN mvn package -DskipTests

# Run stage
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Copy dependencies first (these change rarely)
COPY --from=build /app/target/lib ./lib
# Copy the thin jar (this changes every build)
COPY --from=build /app/target/*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=prod

EXPOSE 8080
# Run with classpath including lib folder
ENTRYPOINT ["java", "-cp", "app.jar:lib/*", "com.caius.agent.JavaBackendApplication"]
