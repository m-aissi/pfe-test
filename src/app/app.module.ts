import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule} from '@angular/material/dialog'; 
import { ArchetypePreviewComponent } from './archetype-preview/archetype-preview.component';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { DragDropModule } from "@angular/cdk/drag-drop";
import { MergeArchetypeComponent } from './merge-archetype/merge-archetype.component';
import { CreateArchetypeComponent } from './create-archetype/create-archetype.component';
@NgModule({
  declarations: [
    AppComponent,
    ArchetypePreviewComponent,
    MergeArchetypeComponent,
    CreateArchetypeComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule,
    MatDialogModule,
    ScrollingModule,
    DragDropModule,
    ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
