const mongoose = require('mongoose');
const Intervention = require('../models/intervention');
const PingResult = require('../models/ping');
const Equip = require('../models/equip');
const Alert = require('../models/Alert');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const analyzeLatencies = (latencies) => {
  if (latencies.length === 0) return 0;
  const sum = latencies.reduce((acc, latency) => acc + latency, 0);
  return sum / latencies.length;
};

const findFollowUps = async (parentId, seenInterventions = new Set()) => {
  if (seenInterventions.has(parentId.toString())) {
    return []; // If we have already seen this intervention, don't fetch its follow-ups
  }
  seenInterventions.add(parentId.toString());

  const followUps = await Intervention.find({
    parentIntervention: parentId,
  }).populate('equipment').exec();

  let allFollowUps = [];
  for (const followUp of followUps) {
    allFollowUps.push(followUp);
    const nestedFollowUps = await findFollowUps(followUp._id, seenInterventions);
    allFollowUps.push(...nestedFollowUps);
  }
  return allFollowUps;
};

const generateInterventionReport = async (startDate, endDate, equipmentIds) => {
  const equipmentObjectIds = equipmentIds.map(id => new mongoose.Types.ObjectId(id));
  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);

  if (isNaN(parsedStartDate.valueOf()) || isNaN(parsedEndDate.valueOf())) {
    throw new Error('Invalid date format');
  }

  const baseInterventions = await Intervention.find({
    equipment: { $in: equipmentObjectIds },
    date: { $gte: parsedStartDate, $lte: parsedEndDate },
  }).populate('equipment').exec();

  let allInterventionsWithAlerts = [];

  for (const baseIntervention of baseInterventions) {
    const followUps = await findFollowUps(baseIntervention._id, new Set([baseIntervention._id.toString()]));

    const allRelatedInterventions = [baseIntervention, ...followUps];

    const interventionsWithAlerts = await Promise.all(allRelatedInterventions.map(async (intervention) => {
      const alerts = await Alert.find({ interventionId: intervention._id }).lean();
      return {
        ...intervention.toObject(),
        alerts: alerts
      };
    }));

    allInterventionsWithAlerts.push(...interventionsWithAlerts);
  }

  return allInterventionsWithAlerts;
};

const createInterventionSummary = async (interventionWithAlerts, index) => {
  let summary =
    `Intervention ${index + 1}:\n` +
    `Equipment: ${interventionWithAlerts.equipment.Nom}\n` +
    `Type: ${interventionWithAlerts.type}\n` +
    `Description: ${interventionWithAlerts.description}\n` +
    `Date: ${formatDate(interventionWithAlerts.date)}\n`;

  if (interventionWithAlerts.latency) {
    summary += `Average Latency: ${interventionWithAlerts.latency}\n`;
  }

  const alertsSummary = interventionWithAlerts.alerts.map(alert => {
    let alertStatus = alert.status === 'dysfonctionnel' ? 'dysfonctionnel' : 'En bon état';
    let resolvedStatus = alert.resolved ? ' a résolu le problème ' : "n'a pas résolu le problème ";
    return `Status de l'équipement: ${alertStatus}\nL'intervention: ${resolvedStatus}\nDate: ${formatDate(alert.timestamp)}\n`;
  }).join("\n");

  summary += alertsSummary.length > 0 ? `\nAlerts:\n${alertsSummary}` : "\nNo alerts";

  return summary + '\n\n';
};

function formatDate(date) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function generatePDF(reportContent) {
  return new Promise((resolve, reject) => {
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const filename = `report-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);
    const doc = new PDFDocument();

    doc.pipe(fs.createWriteStream(filePath))
      .on('finish', () => resolve(filePath))
      .on('error', (error) => reject(error));

    doc.fontSize(20).text('Rapport des interventions ', { align: 'center' }).moveDown(2);

    doc.fontSize(12).text(reportContent, {
      width: 500,
      align: 'left',
    });

    doc.end();
  });
}

const createFullReport = async (interventionsWithAlerts) => {
  let fullReport = '';

  for (let i = 0; i < interventionsWithAlerts.length; i++) {
    const interventionWithAlerts = interventionsWithAlerts[i];
    const summary = await createInterventionSummary(interventionWithAlerts, i);
    fullReport += summary;
  }

  if (fullReport.trim() === '') {
    throw new Error('No intervention summaries could be generated.');
  }

  const reportFilePath = await generatePDF(fullReport);
  return reportFilePath;
};

module.exports = {
  generateInterventionReport,
  createFullReport,
};
