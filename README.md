<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Run in local
- `docker-compose up -d;`
- `npm run start:dev`

## Enter to Database 
- En el contenedor, correr: `mysql -u owner -p`
- Contraseña: `0wn3r`
- Introducir comando: `use sigsa_db;`

## Seed Database
Para meter datos en la DB hay que correr  `npm run seed`.
Si falla con el error "MODULE_NOT_FOUND", seguramente haya que renombrar una ruta de importacion en el
archivo que muestra como primero en el Require stack del log del error. Cambiar de src/... a varios ../ hasta encontrar el archivo que necesitamos.

