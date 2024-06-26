const InterventionService = require("../services/interventionService");
const Intervention = require("../models/intervention"); // Ensure this is correctly pointing to the Intervention model file
const eventEmitter = require('../services/event-emitter');
const mongoose = require('mongoose');

module.exports = class InterventionController {
    static async apiGetAllInterventions(req, res) {
        try {
            const interventions = await InterventionService.getAllInterventions();
            if (!interventions || interventions.length === 0) {
                res.status(404).json("There are no interventions published yet!");
            } else {
                res.json(interventions);
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async apiGetInterventionById(req, res) {
        try {
            const id = req.params.id;
            const intervention = await InterventionService.getInterventionById(id)
;
            res.json(intervention);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async apiCreateIntervention(req, res, next) {
      try {
        const { type, description, equipment, date, parentIntervention,adresseMail} = req.body;
        if (!mongoose.Types.ObjectId.isValid(equipment)) {
            return res.status(400).json({ error: "Invalid equipment ID" });
        }
        // Assurez-vous que parentIntervention est null si elle est une chaîne vide
        const formattedParentIntervention = parentIntervention === "" ? null : parentIntervention;
      // Assurez-vous que l'ID de l'équipement est valide
    
        const newIntervention = new Intervention({
          type,
          description,
          equipment,
          date,
          parentIntervention: formattedParentIntervention,
          adresseMail
        });
    
        const savedIntervention = await newIntervention.save();
    
        setTimeout(() => {
          eventEmitter.emit('evaluateEquipment', savedIntervention._id);
        }, 180000); // 3 minutes
    
        res.status(201).json(savedIntervention);
      } catch (error) {
        console.error("Error creating intervention:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
    
    static async apiUpdateIntervention(req, res) {
        try {
            const interventionId = req.params.id;
            const { type, description, equipment, date, parentIntervention,adresseMail } = req.body;
            const updateResponse = await InterventionService.updateIntervention(interventionId, {
                type, description, equipment, date, parentIntervention,adresseMail
            });
            if (updateResponse.nModified === 0) {
                throw new Error("Unable to update intervention, error occurred");
            }
            res.json(updateResponse);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async apiDeleteIntervention(req, res) {
        try {
            const interventionId = req.params.id;
            const deleteResponse = await InterventionService.deleteIntervention(interventionId);
            res.json(deleteResponse);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async apiGetInterventionsByEquipment(req, res) {
        try {
            const { equipmentIds } = req.body;
            const results = await InterventionService.getInterventionsByEquipment(equipmentIds);
            res.json(results);
        } catch (error) {
            console.error('Error fetching interventions by equipment:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    static async apiSearchInterventions(req, res) {
        try {
            const searchQuery = req.query.search || '';
            const regex = new RegExp(searchQuery, 'i'); // Case insensitive
            const interventions = await Intervention.find({
                $or: [{ description: { $regex: regex } }, { type: { $regex: regex } }]
            }).limit(3);
            res.json(interventions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};