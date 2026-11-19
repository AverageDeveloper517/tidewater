import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, duration, OK, ACCENT, GOLD, WARN, DANGER } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { addXp, credit } from '../services/economy.js';
import { goodPrice } from '../services/market.js';
import { buildContracts, isExpired, missingFor } from '../lib/contracts.js';
import { timeTag } from '../lib/util.js';

const LOCK_MS = 10 * 60_000;

const itemsLine = (contract) =>
  contract.items.map((item) => `${item.name} ×${num(item.qty)}`).join(' · ');

const contractField = (contract, { action = true } = {}) => ({
  name: `${contract.slot}. ${contract.title}`,
  value:
    `${contract.brief}\n` +
    `${itemsLine(contract)}\n` +
    `pays **${shells(contract.reward)}** · +${contract.xp} xp` +
    (action ? ` · \`/contracts take slot:${contract.slot}\`` : ''),
  inline: false
});

export default {
  data: new SlashCommandBuilder()
    .setName('contracts')
    .setDescription('three daily harbour jobs - deliver goods, get paid')
    .addSubcommand((s) => s.setName('view').setDescription('the board and your current job'))
    .addSubcommand((s) =>
      s
        .setName('take')
        .setDescription('accept one of the three jobs')
        .addIntegerOption((o) =>
          o.setName('slot').setDescription('which job').setRequired(true).setMinValue(1).setMaxValue(3)
        )
    )
    .addSubcommand((s) => s.setName('deliver').setDescription('hand over the goods for your job'))
    .addSubcommand((s) => s.setName('abandon').setDescription('drop the job, 10 minute lockout')),

  ephemeral: true,
  cooldownMs: 2000,

  async run({ interaction, options, reply, economy, market }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const sub = options.getSubcommand();
    const guildId = interaction.guildId ?? 'global';
    const now = Date.now();

    const boardNow = async () => {
      const board = await market.board();
      return buildContracts({
        guildId,
        date: new Date(),
        priceOf: (key) => goodPrice(key, board.fxFactor)
      });
    };

    if (sub === 'view') {
      const contracts = await boardNow();
      const active = player.contract && !isExpired(player.contract, now) ? player.contract : null;
      const stale = player.contract && isExpired(player.contract, now) ? player.contract : null;

      const fields = [];
      if (active) {
        const missing = missingFor(active, player.goods);
        fields.push({
          name: `active · ${active.title}`,
          value:
            `${itemsLine(active)}\n` +
            (missing.length
              ? `missing: ${missing.map((m) => `${m.name} ${m.have}/${m.need}`).join(', ')}`
              : 'all goods in the hold - `/contracts deliver`') +
            `\nwindow ends ${timeTag(active.expires, 'R')}`
        });
      }
      if (stale) {
        fields.push({
          name: 'expired job',
          value: `${stale.title}\nthe window closed - taking a new job clears it.`
        });
      }
      fields.push(...contracts.map((contract) => contractField(contract, { action: !active })));

      return reply({
        embeds: [
          card({
            title: 'the harbour board',
            description:
              `${active ? 'you already have a job. finish it before taking another.' : 'three jobs, one hold, one day.'}\n` +
              `the board resets at midnight UTC.`,
            color: active ? GOLD : ACCENT,
            fields,
            footer: `resets ${timeTag(contracts[0].expires, 'R')} · same board for everyone in this server`
          })
        ]
      });
    }

    if (sub === 'take') {
      const slot = options.getInteger('slot', true);

      if (player.contract && !isExpired(player.contract, now)) {
        return reply({
          embeds: [
            card({
              title: 'already carrying a job',
              description: `**${player.contract.title}** ends ${timeTag(player.contract.expires, 'R')}.\nfinish it or \`/contracts abandon\`.`,
              color: WARN
            })
          ]
        });
      }

      if (player.contractLock && player.contractLock > now) {
        return reply({
          embeds: [
            card({
              title: 'the board is closed to you',
              description: `you walked away from the last one. try again in **${duration(player.contractLock - now)}**.`,
              color: WARN
            })
          ]
        });
      }

      const contracts = await boardNow();
      const chosen = contracts.find((contract) => contract.slot === slot);
      if (!chosen) {
        return reply({ embeds: [card({ title: 'no such job', description: 'slots are 1, 2 and 3.', color: DANGER })] });
      }

      const { result } = await economy.update(interaction.user.id, (p) => {
        if (p.contract && !isExpired(p.contract, Date.now())) return { ok: false };
        if (p.contractLock && p.contractLock > Date.now()) return { ok: false, locked: true };
        p.contract = { ...chosen, takenAt: Date.now() };
        return { ok: true };
      });

      if (!result?.ok) {
        return reply({
          embeds: [card({ title: 'the board moved', description: 'try `/contracts view` again.', color: WARN })]
        });
      }

      return reply({
        embeds: [
          card({
            title: `taken · ${chosen.title}`,
            description:
              `${chosen.brief}\n\n` +
              `**deliver:** ${itemsLine(chosen)}\n` +
              `**pays:** ${shells(chosen.reward)} · +${chosen.xp} xp\n\n` +
              `the job is yours until ${timeTag(chosen.expires, 't')} (${timeTag(chosen.expires, 'R')}).`,
            color: OK,
            fields: [
              { name: 'slot', value: String(chosen.slot), inline: true },
              { name: 'reference', value: `\`${chosen.id}\``, inline: true },
              { name: 'abandon', value: `\`/contracts abandon\` · ${duration(LOCK_MS)} lockout`, inline: true }
            ]
          })
        ]
      });
    }

    if (sub === 'deliver') {
      const contract = player.contract;
      if (!contract) {
        return reply({
          embeds: [card({ title: 'nothing to deliver', description: 'take a job with `/contracts take`.', color: WARN })]
        });
      }

      if (isExpired(contract, now)) {
        await economy.update(interaction.user.id, (p) => {
          if (p.contract?.id === contract.id) p.contract = null;
        });
        return reply({
          embeds: [
            card({
              title: 'the window closed',
              description: `**${contract.title}** expired at ${timeTag(contract.expires, 't')}.\nthe job is cleared - take another from \`/contracts view\`.`,
              color: WARN
            })
          ]
        });
      }

      const missing = missingFor(contract, player.goods);
      if (missing.length) {
        return reply({
          embeds: [
            card({
              title: 'short on the manifest',
              description: missing.map((m) => `**${m.name}** ${m.have}/${m.need}`).join('\n'),
              color: DANGER,
              footer: 'fish, garden and harvest fill the hold'
            })
          ]
        });
      }

      const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
        if (!p.contract || p.contract.id !== contract.id) return { ok: false };
        if (isExpired(p.contract, Date.now())) return { ok: false, expired: true };
        if (missingFor(p.contract, p.goods).length) return { ok: false };

        for (const item of p.contract.items) {
          p.goods[item.key] -= item.qty;
          if (p.goods[item.key] <= 0) delete p.goods[item.key];
        }

        credit(p, p.contract.reward);
        addXp(p, p.contract.xp);
        p.stats.contracts = (p.stats.contracts ?? 0) + 1;
        const done = p.contract;
        p.contract = null;
        return { ok: true, wallet: p.wallet, done };
      });

      if (!result?.ok) {
        return reply({
          embeds: [
            card({
              title: 'the handover failed',
              description: result?.expired ? 'the job expired while you were loading.' : 'the hold moved - try again.',
              color: WARN
            })
          ]
        });
      }

      return reply({
        embeds: [
          card({
            title: `delivered · ${result.done.title}`,
            description:
              `${itemsLine(result.done)} handed over.\n` +
              `**${shells(result.done.reward)}** and +${result.done.xp} xp.` +
              unlockedText(fresh),
            color: OK,
            fields: [
              { name: 'wallet', value: shells(after?.wallet ?? result.wallet), inline: true },
              { name: 'jobs done', value: num(after?.stats?.contracts ?? 1), inline: true },
              { name: 'reference', value: `\`${result.done.id}\``, inline: true }
            ]
          })
        ]
      });
    }

    // abandon
    if (!player.contract) {
      return reply({
        embeds: [card({ title: 'nothing to abandon', description: 'the board is already clear.', color: ACCENT })]
      });
    }

    await economy.update(interaction.user.id, (p) => {
      p.contract = null;
      p.contractLock = Date.now() + LOCK_MS;
    });

    return reply({
      embeds: [
        card({
          title: 'walked away',
          description: `the job is back on tomorrow's board. you can take another in **${duration(LOCK_MS)}**.`,
          color: WARN
        })
      ]
    });
  }
};
