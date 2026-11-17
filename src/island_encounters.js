export function islandEncountersFor(island, character) {
  const present = island && character?.status !== "dead" && !character?.captured &&
    !character?.location?.atSea && character?.location?.island === island.name;
  if (!present) return [];

  const world = character.world?.shared?.world;
  const control = world?.islands_control?.find((entry) => entry.island_id === island.id);
  const faction = control?.faction || island.control;
  const day = Number(character.world?.day) || 0;
  const encounters = [];
  const lastTributeDay = Number(character.world?.lastTributeDay);
  const tributeAvailable = !Number.isFinite(lastTributeDay) || day - lastTributeDay >= 7;
  if (island.affiliated && tributeAvailable) {
    encounters.push({
      action: "tribute",
      title: "Tributo en disputa",
      description: "La guarnición deja el cargamento expuesto; puedes intervenir antes de que zarpe.",
      warning: "Saquearlo empeorará tu relación con la Marina.",
      buttonLabel: "Intervenir"
    });
  }
  const sabotaged = character.revolutionarySupport?.sabotagedIslands?.includes(island.id);
  if (faction === "Tirano" && !sabotaged && ["Libertad", "Caos"].includes(character.soulCard?.alignment)) {
    encounters.push({
      action: "sabotage",
      title: "Contacto de la resistencia",
      description: "Una célula local ofrece refugio y suministros si ayudas a desarticular el control tiránico.",
      warning: "",
      buttonLabel: "Ayudar a la resistencia"
    });
  }
  const convoySeed = [...`${character.id}:${island.id}:${day}`]
    .reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  if (!character.world?.nobleAlert && convoySeed % 9 === 0) {
    encounters.push({
      action: "noble",
      title: "Comitiva bajo escolta",
      description: "Una comitiva noble cruza el puerto con una escolta reducida.",
      warning: "Atacarla provoca una respuesta global de la Marina y una recompensa extraordinaria.",
      buttonLabel: "Interceptar la comitiva"
    });
  }
  return encounters;
}
