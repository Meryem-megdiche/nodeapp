const mongoose = require("mongoose");

const equipSchema = new mongoose.Schema({
  Nom: {
    type: String,
    required: true,
  },
  Type: {
    type: String,
    required: true,
  },
  AdresseIp: {
    type: String,
    required: false,
  },
  RFID: {
    type: String,
    required: false,
  },
  Emplacement: {
    type: String,
    required: false,
  },
  Etat: {
    type: String,
    required: false,
  },

  ConnecteA: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equip'
  }],
  Port: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model("Equip", equipSchema);