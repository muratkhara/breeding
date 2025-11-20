require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Veritabanı yerine RAM'de tut (Pella ücretsizte restart atmıyor, veri kaybolmaz)
const bahceler = new Map(); // userId => {seviye: 0/1, plantTime: number, coin: number}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const activeSeeds = new Map();

client.once('ready', async () => {
  console.log(`${client.user.tag} hazır! 🌱 Tohum oyunu aktif!`);
  await client.application.commands.set([
    new SlashCommandBuilder().setName('tohum').setDescription('Birine tohum gönder!').addUserOption(o => o.setName('kullanici').setDescription('Kişi').setRequired(true)),
    new SlashCommandBuilder().setName('bahce').setDescription('Bahçeni kontrol et'),
    new SlashCommandBuilder().setName('hasat').setDescription('1 hafta dolduysa hasat et (+100 coin)')
  ].map(c => c.toJSON()));
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const get = id => bahceler.get(id) || {seviye: 0, plantTime: null, coin: 0};
  const set = (id, data) => bahceler.set(id, data);

  if (i.commandName === 'tohum') {
    const target = i.options.getUser('kullanici');
    if (target.id === i.user.id || target.bot) return i.reply({content:'Geçersiz hedef!',ephemeral:true});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`kabul_${i.id}`).setLabel('Kabul Et').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`red_${i.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
    );

    await i.reply({content:`<@${target.id}>, <@${i.user.id}> sana tohum gönderdi!`, components:[row]});
    activeSeeds.set(i.id, {target: target.id});
  }

  if (i.commandName === 'bahce') {
    const d = get(i.user.id);
    let msg = d.seviye === 1 ? (Date.now() - d.plantTime >= 604800000 ? 'Hasat hazır!' : 'Çimlendi, bekleniyor...') : 'Boş bahçe';
    await i.reply({embeds:[new EmbedBuilder().setTitle(`${i.user.username}'ın Bahçesi`).setDescription(msg).addFields({name:'Coin',value: `${d.coin}`}).setColor(0x00ff00)]});
  }

  if (i.commandName === 'hasat') {
    const d = get(i.user.id);
    if (d.seviye !== 1 || Date.now() - d.plantTime < 604800000) return i.reply({content:'Henüz hazır değil!',ephemeral:true});
    set(i.user.id, {seviye: 0, plantTime: null, coin: d.coin + 100});
    await i.reply(`Hasat başarılı! +100 coin kazandın! Toplam: ${d.coin + 100} 💰`);
  }

  if (i.isButton()) {
    const [islem, id] = i.customId.split('_');
    const teklif = activeSeeds.get(id);
    if (!teklif || i.user.id !== teklif.target) return;

    if (islem === 'kabul') {
      set(i.user.id, {seviye: 1, plantTime: Date.now(), coin: get(i.user.id).coin});
      await i.update({content:'', embeds:[new EmbedBuilder().setTitle('Bahçe Çimlendi!').setDescription(`**${i.user.username}'ın bahçesi çimlendi!**\n1 hafta sonra +100 coin hasat`).setColor(0x32CD32)], components:[]});
    } else {
      await i.update
