import { Component } from '@angular/core';
import { Inject } from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog'; 
import { MatDialogRef } from '@angular/material/dialog';
import { CardSearch } from '../app.component';




@Component({
  selector: 'app-create-archetype',
  templateUrl: './create-archetype.component.html',
  styleUrls: ['./create-archetype.component.css']
})


export class CreateArchetypeComponent {
  
  private isDialogClosed = false; 
  cardSelected : any = 0;
  cardListComplete : any;
  //on decalre cardlist []
  //on le delcare vide comme cardList qu'on vietn d'import
  //on va l'initialiser avec les 50 premiers elements de data.dataKey
  cardList : CardSearch[] = [];

  pagination : any = 0;
  archetypeCover : any;
  nbOwned : any;
  nbOwnedFav : any;
  nbFav: any;
  constructor(
    public dialogRef: MatDialogRef<CreateArchetypeComponent>,  
    @Inject(MAT_DIALOG_DATA) public data: any
 ) {

    // Directly access the dataKey property
    this.cardListComplete = this.data.dataKey;

    for (let result of this.cardList) {
      console.log("happy");
    }

    //how to sleep in typescript
    //await new Promise(r => setTimeout(r, 2000));
    this.getCardList();

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

ngOnInit() {

} 
  getCardList(){
    let min = this.pagination * 50;
    let max = this.pagination * 50 + 50;
    this.pagination++;
    return this.cardList = this.cardListComplete.slice(min,max); 
  }
  changePagination(i : any){
    this.cardList = this.cardListComplete.slice(i*50, i*50+50);
  }
  changePreview(i : any){
    this.cardSelected = i;
  }

}
