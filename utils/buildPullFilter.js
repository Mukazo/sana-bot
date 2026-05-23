function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPullFilter(rarity, user) {
  const blockedGroups = (user?.blockedPulls?.groups || []).map(v =>
    String(v).toLowerCase()
  );

  const blockedNames = (user?.blockedPulls?.names || []).map(v =>
    String(v).toLowerCase()
  );

  const blockedPairs = user?.blockedPulls?.pairs || [];

  return {
    rarity,
    active: true,
    batch: null,
    $and: [
      {
        $or: [
          { releaseAt: null },
          { releaseAt: { $lte: new Date() } },
        ],
      },
      {
        $or: [
          { availableQuantity: null },
          { $expr: { $lt: ['$timesPulled', '$availableQuantity'] } },
        ],
      },
      
      ...(blockedGroups.length
        ? [
            {
              $and: [
                {
                  group: {
                    $nin: blockedGroups.map(
                      v => new RegExp(`^${escapeRegex(v)}$`, 'i')
                    ),
                  },
                },
                {
                  groupalias: {
                    $nin: blockedGroups.map(
                      v => new RegExp(`^${escapeRegex(v)}$`, 'i')
                    ),
                  },
                },
              ],
            },
          ]
        : []),

      ...(blockedNames.length
        ? [
            {
              $and: [
                {
                  name: {
                    $nin: blockedNames.map(
                      v => new RegExp(`^${escapeRegex(v)}$`, 'i')
                    ),
                  },
                },
                {
                  namealias: {
                    $nin: blockedNames.map(
                      v => new RegExp(`^${escapeRegex(v)}$`, 'i')
                    ),
                  },
                },
              ],
            },
          ]
        : []),

      ...(blockedPairs.length
        ? [
            {
              $nor: blockedPairs.map(pair => {
                const safeGroup = escapeRegex(pair.group);
                const safeName = escapeRegex(pair.name);

                return {
                  $or: [
                    {
                      group: new RegExp(`^${safeGroup}$`, 'i'),
                      $or: [
                        { name: new RegExp(`^${safeName}$`, 'i') },
                        { namealias: new RegExp(`^${safeName}$`, 'i') },
                      ],
                    },
                    {
                      groupalias: new RegExp(`^${safeGroup}$`, 'i'),
                      $or: [
                        { name: new RegExp(`^${safeName}$`, 'i') },
                        { namealias: new RegExp(`^${safeName}$`, 'i') },
                      ],
                    },
                  ],
                };
              }),
            },
          ]
        : []),
    ],
  };
}

module.exports = buildPullFilter;