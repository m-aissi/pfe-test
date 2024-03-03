import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MergeArchetypeComponent } from './merge-archetype.component';

describe('MergeArchetypeComponent', () => {
  let component: MergeArchetypeComponent;
  let fixture: ComponentFixture<MergeArchetypeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MergeArchetypeComponent]
    });
    fixture = TestBed.createComponent(MergeArchetypeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
