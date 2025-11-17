const mongoose=require("mongoose");

const {goalSchema}=require("@matestampa/diffum-goals_mongoose-schemas");

// Creación del modelo a partir del esquema
const GoalModel = mongoose.model('Goal', goalSchema);

module.exports= {GoalModel};