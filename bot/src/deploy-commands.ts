const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Create and connect a NOVA league")
    .addStringOption((o) =>
      o.setName("league")
        .setDescription("League name")
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("division1")
        .setDescription("Division 1")
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("division2")
        .setDescription("Optional Division 2")
        .setRequired(false),
    )
    .addStringOption((o) =>
      o.setName("division3")
        .setDescription("Optional Division 3")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("addteam")
    .setDescription("Add a team to your league"),

  new SlashCommandBuilder()
    .setName("makedivision")
    .setDescription("Create a division"),

  new SlashCommandBuilder()
    .setName("startdivision")
    .setDescription("Start a division"),

  new SlashCommandBuilder()
    .setName("enddivision")
    .setDescription("End a division"),

  new SlashCommandBuilder()
    .setName("submitresult")
    .setDescription("Submit a match result"),

  new SlashCommandBuilder()
    .setName("setcooverseer")
    .setDescription("Add a Co-Overseer"),

  new SlashCommandBuilder()
    .setName("removeoverseer")
    .setDescription("Remove a Co-Overseer"),

  new SlashCommandBuilder()
    .setName("transferleague")
    .setDescription("Transfer league ownership"),
].map((command) => command.toJSON());
