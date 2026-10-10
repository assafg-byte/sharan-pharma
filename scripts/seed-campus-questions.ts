/**
 * One-time seeder — Mounjaro adverse-event training questions (שאלות תרגול)
 * Run: npx tsx scripts/seed-campus-questions.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

const questions = [
  // ── חלק א׳ – נכון או לא נכון ─────────────────────────────────────────────
  {
    text: "שאלה רפואית שהתעוררה במהלך דיווח תופעת לוואי ניתן לרשום בטופס הדיווח.",
    type: "TRUE_FALSE",
    optionA: "נכון",
    optionB: "לא נכון",
    optionC: "",
    optionD: "",
    correctAnswers: "A",
    explanation: "שאלה רפואית אינה מוזנת ב-Power Apps ויש להעביר אותה במייל בלבד – אלא אם כן היא הועלתה במהלך דיווח. במקרה כזה ניתן לרשום אותה בטופס.",
  },
  {
    text: "ניתן להניח שהמדווח הוא המטופל עצמו על פי שמו, ולכן אין צורך לציין את תפקיד המדווח.",
    type: "TRUE_FALSE",
    optionA: "נכון",
    optionB: "לא נכון",
    optionC: "",
    optionD: "",
    correctAnswers: "B",
    explanation: "אסור להניח את זהות המדווח לפי שמו בלבד. תפקיד המדווח הוא שדה חובה – יש לשאול ולציין: אחות, רופא, המטופל עצמו וכו'.",
  },
  {
    text: "כתובת מייל של המדווח היא חובה במקרה של דיווח תופעת לוואי.",
    type: "TRUE_FALSE",
    optionA: "נכון",
    optionB: "לא נכון",
    optionC: "",
    optionD: "",
    correctAnswers: "A",
    explanation: "יש לבקש מייל מהמדווח בכל מקרה של AE. בקשות מעקב גלובליות נשלחות במייל – טלפון בלבד אינו מספיק.",
  },
  {
    text: "ניתן לבחור באפשרות Unknown בשדה ההסכמה ליצירת קשר כאשר המטופל לא ברור בעמדתו.",
    type: "TRUE_FALSE",
    optionA: "נכון",
    optionB: "לא נכון",
    optionC: "",
    optionD: "",
    correctAnswers: "B",
    explanation: "יש לבחור כן או לא בלבד. האפשרות Unknown אינה תקפה ואסור לבחור בה. אם המטופל לא ברור – יש לברר.",
  },
  {
    text: "מסמכי Source Document הם מסמכים משפטיים שעוברים ביקורת של משרד הבריאות.",
    type: "TRUE_FALSE",
    optionA: "נכון",
    optionB: "לא נכון",
    optionC: "",
    optionD: "",
    correctAnswers: "A",
    explanation: "טפסי הדיווח הם מסמכים משפטיים לכל דבר, עוברים בקרות אודיט ובדיקות של משרד הבריאות, ועלולים לשמש כחלק מתיק משפטי.",
  },
  {
    text: "אם מטופל סירב לפנייה נוספת, ניתן עדיין ליצור איתו קשר אם יש מידע חשוב לשתף.",
    type: "TRUE_FALSE",
    optionA: "נכון",
    optionB: "לא נכון",
    optionC: "",
    optionD: "",
    correctAnswers: "B",
    explanation: "יש לכבד את רצון המטופל. אם ציין לא – אנו לא יוצרים איתו קשר בשום מצב. ניתן לרשום את הסיבה שנתן בתיאור האירוע.",
  },
  {
    text: "שימוש לא לפי עלון על פי הוראת רופא (Off-Label Use) אינו נחשב תופעת לוואי ואין לדווח עליו.",
    type: "TRUE_FALSE",
    optionA: "נכון",
    optionB: "לא נכון",
    optionC: "",
    optionD: "",
    correctAnswers: "B",
    explanation: "כל סוגי השימוש הלא תקניים – Off-Label Use, Misuse ו-Medication Error – מדווחים כ-AE ללא יוצא מן הכלל.",
  },

  // ── חלק ב׳ – שאלה עם תשובה אחת מתוך 4 ──────────────────────────────────
  {
    text: "מטופל מדווח על כאבי בטן לאחר מעבר למינון 15 מ\"ג מאונג'רו. מה השאלה הראשונה שחובה לשאול?",
    type: "SINGLE_CHOICE",
    optionA: "כמה זמן הכאב נמשך?",
    optionB: "מתי בדיוק התחילו הכאבים ובאיזה מינון?",
    optionC: "האם המטופל גר קרוב לבית חולים?",
    optionD: "האם המטופל אכל לפני ההזרקה?",
    correctAnswers: "B",
    explanation: "חובה לברר את המינון והעיתוי המדויק של התופעה. אם הופיעו מספר תופעות, יש לדעת תחת איזה מינון כל אחת התרחשה.",
  },
  {
    text: "איזה מהמקרים הבאים אינו מצריך דיווח?",
    type: "SINGLE_CHOICE",
    optionA: "שימוש במזרק מעבר ל-30 יום",
    optionB: "הזרקת שארית לאחר שאיבה עם מחט חיצונית",
    optionC: "מטופל ששאב שארית עם מחט חיצונית אך לא הזריק",
    optionD: "הזרקה חלקית בלבד",
    correctAnswers: "C",
    explanation: "אם המטופל שאב שארית עם מחט חיצונית אך לא הזריק – אין צורך לדווח. הדיווח נדרש רק אם הנוזל אכן הוזרק.",
  },
  {
    text: "מה הדרך הנכונה לכתוב שם המדווח בטופס?",
    type: "SINGLE_CHOICE",
    optionA: "שם משפחה ולאחריו שם פרטי",
    optionB: "ראשי תיבות בלבד",
    optionC: "שם פרטי ולאחריו שם משפחה",
    optionD: "מספר תעודת זהות",
    correctAnswers: "C",
    explanation: "יש להקפיד על סדר אחיד: שם פרטי לפני שם משפחה. כך גם לגבי ראשי תיבות.",
  },
  {
    text: "מתי יש לכתב (CC) את מחלקת בטיחות התרופות במייל?",
    type: "SINGLE_CHOICE",
    optionA: "בכל שרשורי מייל הקשורים למאונג'רו",
    optionB: "רק כשהמידע קשור ישירות למחלקת בטיחות התרופות",
    optionC: "רק כשיש תלונת איכות",
    optionD: "בכל מקרה שבו הוזכרה תופעת לוואי",
    correctAnswers: "B",
    explanation: "יש לכתב את המחלקה רק כשהמידע רלוונטי – כגון מספר אצווה, תוקף, או תקלה במוצר. שרשורי מייל ארוכים גורמים לפספוס מידע.",
  },
  {
    text: "מטופל טוען שהזריק רק 3 מנות מהמזרק. מה הדין?",
    type: "SINGLE_CHOICE",
    optionA: "יש לדווח מיד כי המטופל אמר זאת",
    optionB: "אין לדווח – טענה ללא אימות אינה נחשבת לדיווח תקף",
    optionC: "לשאול את המטופל שוב כדי לוודא",
    optionD: "להפנות לרופא המטפל",
    correctAnswers: "B",
    explanation: "אם לא בוצעה בדיקת המזרק בפועל ואין אימות – הטענה לבדה אינה מהווה דיווח בר-תוקף. יוצא מן הכלל: דיווח מפורש על הזרקה חלקית או יותר ממנה אחת.",
  },
  {
    text: "מה מותר לנו לעשות כשמטופל שואל על חומרת תופעת הלוואי שלו?",
    type: "SINGLE_CHOICE",
    optionA: "להסביר לו לפי שיקול דעתנו הקליני",
    optionB: "להפנות אותו לעלון ולרופא המטפל",
    optionC: "לחפש מידע ולשתף",
    optionD: "להבטיח שנחזור אליו עם תשובה",
    correctAnswers: "B",
    explanation: "מותר להפנות לעלון לצרכן ולרופא המטפל. אסור לתת ייעוץ רפואי, לסווג חומרת אירוע, או להעריך קשר סיבתי.",
  },
  {
    text: "מה הפורמולציה שחובה לציין בעת דיווח הקשור למאונג'רו?",
    type: "SINGLE_CHOICE",
    optionA: "Auto-Injector",
    optionB: "KwikPen",
    optionC: "FlexPen",
    optionD: "SoloStar",
    correctAnswers: "B",
    explanation: "יש לציין במפורש שמדובר ב-KwikPen. זו הפורמולציה של מאונג'רו ויש להקפיד לכלול זאת בכל דיווח.",
  },

  // ── חלק ג׳ – בחירה מרובה ─────────────────────────────────────────────────
  {
    text: "אילו מהמקרים הבאים מחייבים דיווח כתופעת לוואי?",
    type: "MULTI_SELECT",
    optionA: "מטופל שהזריק חצי מנה בלבד",
    optionB: "מטופל שהשתמש במזרק מעבר ל-30 יום",
    optionC: "מטופל ששאב שארית אך לא הזריק",
    optionD: "מטופל שהזריק שארית לאחר שאיבה עם מחט חיצונית",
    correctAnswers: "A,B,D",
    explanation: "כל שימוש שאינו לפי עלון מחייב דיווח: הזרקה חלקית, שימוש מעבר ל-30 יום, והזרקת שארית עם מחט חיצונית. שאיבה ללא הזרקה בפועל אינה מחייבת דיווח.",
  },
  {
    // 5 options in source — ה (מייל המדווח) merged into D with ד
    text: "מה מהבאים חייב להיכלל בטופס הדיווח?",
    type: "MULTI_SELECT",
    optionA: "שם מלא של המטופל",
    optionB: "מין המטופל",
    optionC: "כתובת מגורים של המטופל",
    optionD: "שם ותפקיד המדווח ומייל המדווח (בדיווח AE)",
    correctAnswers: "A,B,D",
    explanation: "שם מלא, מין המטופל, שם ותפקיד המדווח ומייל המדווח הם שדות חובה. כתובת מגורים אינה נדרשת.",
  },
  {
    // ה (דיווח ב-Power Apps) is allowed — not forbidden; dropped from options
    text: "אילו מהפעולות הבאות אסורות על פי הנהלים?",
    type: "MULTI_SELECT",
    optionA: "הבטחה למטופל שנחזור אליו עם תשובה",
    optionB: "הפניה לעלון לצרכן",
    optionC: "הערכת קשר סיבתי בין התרופה לתופעה",
    optionD: "מתן ייעוץ רפואי או קליני",
    correctAnswers: "A,C,D",
    explanation: "אסור להבטיח חזרה, להעריך קשר סיבתי, ולתת ייעוץ רפואי. הפניה לעלון לצרכן ודיווח ב-Power Apps מותרים ואף חובה.",
  },
  {
    // source option ד (שלוח לרופא = wrong) dropped; ה (כל המידע הרלוונטי) becomes D
    text: "מה עלינו לוודא לפני שמירת טופס הדיווח (Source Document)?",
    type: "MULTI_SELECT",
    optionA: "לקרוא בעיון את כל הניסוח",
    optionB: "לוודא שאין תווים מוזרים",
    optionC: "לוודא שרצף ההיגיון שמור ומשפטים מובנים",
    optionD: "לוודא שכל המידע הרלוונטי נכלל",
    correctAnswers: "A,B,C,D",
    explanation: "לפני שמירה יש לקרוא בעיון, לוודא שאין תווים מוזרים, שרצף ההיגיון שמור, ושכל המידע הרלוונטי נכלל. אין צורך לשלוח לאישור רופא לפני שמירה.",
  },
  {
    text: "אילו מהמקרים הבאים מגדירים שימוש לא לפי עלון שיש לדווח?",
    type: "MULTI_SELECT",
    optionA: "Off-Label Use – שימוש לא לפי עלון בהוראת רופא",
    optionB: "Misuse – שימוש לא תקין על דעת המטופל עצמו",
    optionC: "Medication Error – טעות בשימוש ללא כוונה",
    optionD: "שאלה רפואית של המטופל",
    correctAnswers: "A,B,C",
    explanation: "שלושת הסוגים (Off-Label Use, Misuse, Medication Error) מדווחים כ-AE. שאלה רפואית של המטופל אינה AE ומועברת במייל בלבד.",
  },
  {
    // source option ד (האם פנה לרופא = not required) dropped; ה (פורמולציה) becomes D
    text: "מה חייבים לברר כאשר מטופל דיווח על מספר תופעות לוואי שונות?",
    type: "MULTI_SELECT",
    optionA: "תחת איזה מינון התרחשה כל תופעה",
    optionB: "האם התופעות נמשכות",
    optionC: "מתי בדיוק כל תופעה החלה",
    optionD: "הפורמולציה הרלוונטית (KwikPen)",
    correctAnswers: "A,B,C,D",
    explanation: "לכל תופעה: חובה לדעת המינון, העיתוי, האם ממשיכה, והפורמולציה. בדיקת פנייה לרופא אינה שאלת חובה בטופס.",
  },
];

async function main() {
  console.log(`Seeding ${questions.length} Mounjaro training questions...`);
  let created = 0;
  for (const q of questions) {
    await prisma.campusQuestion.create({ data: q });
    created++;
    process.stdout.write(`\r  ${created}/${questions.length}`);
  }
  console.log(`\nDone — ${created} questions added.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
