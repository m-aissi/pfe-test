import { Component } from '@angular/core';
import { Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog'; 
import { MatDialogRef } from '@angular/material/dialog';
import { CardSearch } from '../app.component';

@Component({
  selector: 'app-create-archetype',
  templateUrl: './create-archetype.component.html',
  styleUrls: ['./create-archetype.component.css']
})

export class CreateArchetypeComponent {

  private isDialogClosed = false;

  cardListComplete : any;
  newCardList : CardSearch[] = [];
  cardList : CardSearch[] = [];
  cardListFav : CardSearch[] = [];
  pagination : any = 0;

  toggleFilter : boolean = false;
  lockPreview : boolean = false;
  toggleLock : boolean = false;

  cardPreview : any;
  cardSelected : any = 0;

  filterValue: string = '';
  filterDef: string = '';
  filterAtk: string = '';
  filterLvl: string = '';
  filterScale: string = '';
  filterLink: string = '';
  selectedAttribute : string = '';
  selectedRace : string = '';
  selectedType : string = '';
  archetypTitle : string= '';

  nbOwned : any;
  
  constructor(
    public dialogRef: MatDialogRef<CreateArchetypeComponent>,  
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.cardListComplete = this.data.dataKey;

    this.newCardList = this.cardListComplete;
    this.getCardList();
    this.cardPreview = this.cardList[0];
  }

  closeDialog() {
    this.isDialogClosed = true; // Ajoutez cette ligne
    this.dialogRef.close(this.nbOwned);
  }

  ngOnDestroy() {
    if (!this.isDialogClosed) { // Ajoutez cette ligne
      this.dialogRef.close(this.nbOwned);
    }
  }

  ngOnInit() {} 
  
  getCardList(){
    let min = 0;
    let max = this.pagination * 16 + 16;
    this.pagination++;

    return this.cardList = this.newCardList.slice(min,max); 
  }

  miseEnForme(card : any){
    let text = card.cardType;
    let text2 = card.cardRace;

    text = text.replace("Monster",'');
    if(!text.includes("Card")) text = text.replace(" ","/");

    if(text[text.length-1] == "/") text = text.replace("/","]");        
    else if(text[text.length-1] == " ")text = text.replace(" ","]"); 
    else if(text.includes("Spell") || text.includes("Trap")) return text2 + "/"+text+"]";
    if(text[text.length-1] != ']'){ text = text.replace("]","/"); text = text + ']'; }

    return text2+"/"+text;
  }


  changePreview(card : any){
    if(!this.lockPreview) this.cardPreview = card;
  }

  addCard(card : any){
    this.cardListFav.push(card);

    this.newCardList = this.newCardList.filter(item => item !== card);
    this.cardListComplete = this.cardListComplete.filter((item: any) => item !== card);

    this.newCardList = this.newCardList.sort((a, b) => a.cardName.localeCompare(b.cardName));
    this.cardListComplete = this.cardListComplete.sort((a: { cardName: string; }, b: { cardName: any; }) => a.cardName.localeCompare(b.cardName));

    let max = this.pagination * 16 + 16;
    this.cardList = this.newCardList.slice(0,max)
  }

  removeCard(card : any){
    this.cardListComplete.push(card);
    this.cardListComplete = this.cardListComplete.sort((a: { cardName: string; }, b: { cardName: any; }) => a.cardName.localeCompare(b.cardName));

    this.cardListFav = this.cardListFav.filter(item => item !== card);
    
    this.filterCards();

    let max = this.pagination * 16 + 16;
    this.cardList = this.newCardList.slice(0,max)
  }

  filterCards() {
    let defTmp :any = this.defTmp();
    let atkTmp :any = this.atkTmp();
    let scaleTmp :any = this.scaleTmp();
    let levelTmp :any = this.levelTmp();
    let linkTmp :any = this.linkTmp();

    this.newCardList = this.cardListComplete.filter(
      (card: any)  => 
      (card.cardName.toLowerCase().includes(this.filterValue.toLowerCase()) 
      || 
      card.cardDescription.toLowerCase().includes(this.filterValue.toLowerCase()))
      &&
      parseInt(card.cardDef) >= defTmp
      &&
      parseInt(card.cardAtk) >= atkTmp
      &&
      parseInt(card.cardLevel) >= levelTmp
      &&
      parseInt(card.cardLink) >= linkTmp
      &&
      parseInt(card.cardScale) >= scaleTmp
      &&
      (this.selectedAttribute == '' || card.cardAttribute == this.selectedAttribute)
      &&
      (this.selectedRace == '' || card.cardRace == this.selectedRace)
      &&
      (this.selectedType == '' || card.cardType == this.selectedType) 
    );
    
    this.pagination = 1;
    this.cardList = this.newCardList.slice(0,16);
  }

  create(){
    if(this.archetypTitle != 'Archetyp name...' && this.archetypTitle != ''){
      console.log(this.archetypTitle);
    }
  }

  defTmp(): any {
    if(isNaN(parseInt(this.filterDef))) return parseInt("-1");
    return parseInt(this.filterDef);
  }

  atkTmp(): any {
    if(isNaN(parseInt(this.filterAtk))) return parseInt("-1");
    return parseInt(this.filterAtk);
  }

  scaleTmp(): any {
    if(isNaN(parseInt(this.filterScale))) return parseInt("-1");
    return parseInt(this.filterScale);
  }

  levelTmp(): any {
    if(isNaN(parseInt(this.filterLvl))) return parseInt("-1");
    return parseInt(this.filterLvl);  
  }

  linkTmp(): any {
    if(isNaN(parseInt(this.filterLink))) return parseInt("-1");
    return parseInt(this.filterLink);
  }
}
