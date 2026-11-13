// Contenido del menú. Edita aquí productos y precios (MXN).
// Nombres cortos (máx. ~18 letras) para que entren en una línea.
// Imagen del pan: assets/panes/<nombre-del-producto>.png (minúsculas, sin acentos, con guiones; ej. pain-au-chocolat.png).
// Si el archivo existe, se muestra al tocar el producto; si no, sale un círculo provisional. Opcional: img: "otro-nombre" para usar otro archivo.
// La descripción (d) es opcional: solo cuando el nombre no basta. Máximo una línea corta.
// Precios provisionales: pieza individual ≈ $30–$55; hogazas y panes grandes, más.
window.BOMO_MENU = [
  {
    id: "mesa",
    tab: "Panes de mesa",
    title: "Panes de mesa",
    groups: [
      {
        name: "Masa madre",
        items: [
          { n: "Hogaza campesina", d: "Masa madre, 36 horas de reposo.", p: 85 },
          { n: "Centeno oscuro", d: "Con melaza y alcaravea.", p: 85 },
          { n: "Nuez y arándano", p: 95 }
        ]
      },
      {
        name: "Baguettes y focaccias",
        items: [
          { n: "Baguette", p: 38 },
          { n: "Ciabatta", p: 35 },
          { n: "Focaccia de romero", p: 45 },
          { n: "Focaccia de tomate", p: 48 }
        ]
      },
      {
        name: "Para el desayuno",
        items: [
          { n: "Pan de molde", p: 70 },
          { n: "Brioche salado", p: 55 }
        ]
      }
    ]
  },
  {
    id: "bolleria",
    tab: "Bollería",
    title: "Bollería y hojaldre",
    groups: [
      {
        name: "Hojaldre",
        items: [
          { n: "Croissant", p: 38 },
          { n: "Pain au chocolat", d: "Chocolate oscuro 64 %.", p: 45 },
          { n: "Almendrado", d: "Croissant con crema de almendra.", p: 52 },
          { n: "Kouign-amann", d: "Mantequilla y azúcar caramelizados.", p: 48 }
        ]
      },
      {
        name: "Masas suaves",
        items: [
          { n: "Concha de vainilla", p: 30 },
          { n: "Rol de canela", p: 48 },
          { n: "Danés de manzana", p: 45 }
        ]
      }
    ]
  },
  {
    id: "temporada",
    tab: "Temporada",
    title: "De temporada",
    groups: [
      {
        name: "Pan de muerto",
        items: [
          { n: "Naranja y anís", d: "Clásico, con azahar.", p: 42 },
          { n: "Jamaica", d: "Con flor de jamaica.", p: 48 },
          { n: "Relleno de cajeta", p: 50 },
          { n: "Familiar", d: "6 a 8 porciones.", p: 120 }
        ]
      }
    ]
  }
];

// Post-it de la portada (rojo vivo): lo que viene pronto
window.BOMO_SOON = { tag: "Próximamente", n: "Rosca de Reyes" };   // d: "..." (opcional) agrega una línea de descripción
