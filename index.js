require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Troca pelo ID real do canal onde os moderadores vão receber os diagnósticos
const canalModLogID = '1389655432825405500';
const modelo = 'openai/gpt-4';

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  const conteudo = msg.content.toLowerCase();
  const gatilhos = ['ajuda', 'erro', 'bug', 'problema', 'como faço', 'me ajuda', 'suporte'];

  // Se tiver palavra-chave e ainda não tiver um ticket criado
  if (gatilhos.some(g => conteudo.includes(g))) {
    const existe = msg.guild.channels.cache.find(c => c.name === `ticket-${msg.author.id}`);
    if (existe) return;

    // Cria o canal de ticket privado
    const canal = await msg.guild.channels.create({
      name: `ticket-${msg.author.id}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: msg.guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: msg.author.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    await canal.send(`Salve ${msg.author}, fala melhor o que tá rolando que o suporte chegou 🧠`);

    // Chamada OpenRouter GPT-4
    let analise = 'Diagnóstico não gerado.';
    try {
      const ia = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: modelo,
          messages: [
            {
              role: 'system',
              content: 'Você é um atendente de suporte Discord. Seja direto, entenda o problema e gere um resumo profissional para moderadores.'
            },
            {
              role: 'user',
              content: msg.content
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      analise = ia.data.choices[0].message.content;
    } catch (err) {
      console.error('Erro com OpenRouter:', err.message);
    }

    // Embed para os moderadores
    const embed = new EmbedBuilder()
      .setTitle(`📩 Novo Ticket: ${msg.author.tag}`)
      .setDescription(`**📋 Problema inicial:** ${msg.content}\n\n**🧠 Diagnóstico IA:**\n${analise}`)
      .setColor(0x2B2D31)
      .setFooter({ text: `ID: ${msg.author.id}` })
      .setTimestamp();

    const canalMod = await client.channels.fetch(canalModLogID).catch(() => null);
    if (canalMod && canalMod.isTextBased()) {
      canalMod.send({ embeds: [embed] });
    }
  }
});

client.once('ready', () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);
