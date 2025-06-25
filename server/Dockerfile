FROM ruby:3.2

RUN apt-get update -qq && \
    apt-get install -y build-essential default-mysql-client libmariadb-dev tzdata nodejs yarn

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "bundle exec rails db:prepare && bundle exec rails s -p 3001 -b 0.0.0.0"]
