// routes/games.js
const router = require('express').Router()
const passport = require('../config/auth')
const { Game } = require('../models')
const utils = require('../lib/utils')
const calculateWinner = require('../logics/calculateWinner')

const authenticate = passport.authorize('jwt', { session: false })

module.exports = io => {
  router
    .get('/games', (req, res, next) => {
      Game.find()
        // Newest games first
        .sort({ createdAt: -1 })
        // Send the data in JSON format
        .then((games) => res.json(games))
        // Throw a 500 error if something goes wrong
        .catch((error) => next(error))
    })
    .get('/games/:id', (req, res, next) => {
      const id = req.params.id

      Game.findById(id)
        .then((game) => {
          if (!game) { return next() }
          res.json(game)
        })
        .catch((error) => next(error))
    })
    .post('/games', authenticate, (req, res, next) => {
      const newGame = {
        userId: req.account._id,
        players: [{
          userId: req.account._id
        }],
        board: Array(9).fill(0)
      }

      Game.create(newGame)
        .then((game) => {
          io.emit('action', {
            type: 'GAME_CREATED',
            payload: game
          })
          res.json(game)
        })
        .catch((error) => next(error))
    })
    .put('/games/:id', authenticate, (req, res, next) => {
      const id = req.params.id
      const updatedGame = req.body

      Game.findByIdAndUpdate(id, { $set: updatedGame }, { new: true })
        .then((game) => {
          io.emit('action', {
            type: 'GAME_UPDATED',
            payload: game
          })
          res.json(game)
        })
        .catch((error) => next(error))
    })
    .patch('/games/:id', authenticate, (req, res, next) => {
      const id = req.params.id
      const move = req.body.move
      const player_id = req.body.player_id

      Game.findById(id)
        .then((game) => {

          if (!game) { return next() }

          const moveSymbol = game.turn % 2 == 0 ? "X" : "O"
          game.board[move] = moveSymbol

          if (game.turn % 2 == 0) {
            game.board[move] = "X"
            game.turn++
          } else {
            game.board[move] = "O"
            game.turn--
          }

          if (calculateWinner(game.board) === "X") {
            game.winnerId = player_id
          }

          const updatedGame = { turn: game.turn, board: game.board }

          Game.findByIdAndUpdate(id, { $set: updatedGame }, { new: true })
            .then((game) => {
              io.emit('action', {
                type: 'GAME_UPDATED',
                payload: game
              })
              res.json(game)
            })
            .catch((error) => next(error))
        })
        .catch((error) => next(error))
    })
    .delete('/games/:id', authenticate, (req, res, next) => {
      const id = req.params.id
      Game.findByIdAndRemove(id)
        .then(() => {
          io.emit('action', {
            type: 'GAME_REMOVED',
            payload: id
          })
          res.status = 200
          res.json({
            message: 'Removed',
            _id: id
          })
        })
        .catch((error) => next(error))
    })

  return router
}
