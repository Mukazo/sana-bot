const { SlashCommandBuilder} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('wave')
    .setDescription('Sana waves'),

    async execute(interaction) {
        await interaction.editReply('Hi Once! I am working and online~')
    }
}
