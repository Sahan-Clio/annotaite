FROM ruby:3.2-alpine

RUN apk add --no-cache build-base mysql-client mysql-dev tzdata nodejs yarn yaml-dev

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "bundle exec rails db:prepare && bundle exec rails s -p 3001 -b 0.0.0.0"]
