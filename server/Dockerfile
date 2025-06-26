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

EXPOSE 3001

CMD ["sh", "-c", "bundle exec rails db:prepare && bundle exec rails s -p 3001 -b 0.0.0.0"]
