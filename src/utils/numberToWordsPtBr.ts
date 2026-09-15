/**
 * Converte um valor numérico monetário (BRL) para sua representação textual por extenso em português.
 * Exemplo:
 * 1500.00 -> "um mil e quinhentos reais"
 * 342.50  -> "trezentos e quarenta e dois reais e cinquenta centavos"
 */

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'
];

const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'
];

const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'
];

function converterGrupo(num: number): string {
  if (num === 0) return '';
  if (num === 100) return 'cem';

  const c = Math.floor(num / 100);
  const d = Math.floor((num % 100) / 10);
  const u = num % 10;
  const resto = num % 100;

  const partes: string[] = [];

  if (c > 0) {
    partes.push(CENTENAS[c]);
  }

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else {
      partes.push(DEZENAS[d]);
      if (u > 0) {
        partes.push(UNIDADES[u]);
      }
    }
  }

  return partes.join(' e ');
}

export function numberToWordsPtBr(valor: number): string {
  if (isNaN(valor) || valor === null || valor === undefined) return '';

  const valorArredondado = Math.round((Math.abs(valor) + Number.EPSILON) * 100) / 100;
  const parteInteira = Math.floor(valorArredondado);
  const centavos = Math.round((valorArredondado - parteInteira) * 100);

  if (parteInteira === 0 && centavos === 0) {
    return 'zero reais';
  }

  const partesTexto: string[] = [];

  if (parteInteira > 0) {
    const bilhoes = Math.floor(parteInteira / 1_000_000_000);
    const milhoes = Math.floor((parteInteira % 1_000_000_000) / 1_000_000);
    const milhares = Math.floor((parteInteira % 1_000_000) / 1_000);
    const unidades = parteInteira % 1_000;

    if (bilhoes > 0) {
      const texto = converterGrupo(bilhoes);
      partesTexto.push(`${texto} ${bilhoes === 1 ? 'bilhão' : 'bilhões'}`);
    }

    if (milhoes > 0) {
      const texto = converterGrupo(milhoes);
      partesTexto.push(`${texto} ${milhoes === 1 ? 'milhão' : 'milhões'}`);
    }

    if (milhares > 0) {
      if (milhares === 1) {
        partesTexto.push('um mil');
      } else {
        partesTexto.push(`${converterGrupo(milhares)} mil`);
      }
    }

    if (unidades > 0) {
      partesTexto.push(converterGrupo(unidades));
    }

    const sufixoMoeda = parteInteira === 1 ? 'real' : 'reais';
    partesTexto.push(sufixoMoeda);
  }

  let resultadoInteiro = '';
  if (partesTexto.length > 0) {
    // Une as partes com " e " ou vírgula conforme padrão
    if (partesTexto.length === 2 && partesTexto[1] === 'reais') {
      resultadoInteiro = `${partesTexto[0]} ${partesTexto[1]}`;
    } else {
      const moeda = partesTexto.pop();
      resultadoInteiro = `${partesTexto.join(' e ')} ${moeda}`;
    }
  }

  if (centavos > 0) {
    const textoCentavos = converterGrupo(centavos);
    const sufixoCentavos = centavos === 1 ? 'centavo' : 'centavos';
    if (resultadoInteiro) {
      return `${resultadoInteiro} e ${textoCentavos} ${sufixoCentavos}`;
    } else {
      return `${textoCentavos} ${sufixoCentavos} de real`;
    }
  }

  return resultadoInteiro;
}

/**
 * Retorna o valor por extenso capitalizado (primeira letra maiúscula).
 */
export function formatCurrencyInWords(valor: number): string {
  const texto = numberToWordsPtBr(valor);
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
