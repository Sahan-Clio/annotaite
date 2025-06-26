FROM ruby:3.2-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    default-mysql-client \
    default-libmysqlclient-dev \
    libyaml-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

# Make the entrypoint script executable
RUN chmod +x bin/docker-entrypoint

EXPOSE 3001

ENTRYPOINT ["./bin/docker-entrypoint"]
